import type { MapCoordinate } from '../types';

interface KakaoMapHtmlParams {
  jsApiKey: string;
  initialCenter: MapCoordinate;
  initialMarker?: MapCoordinate;
}

export function buildKakaoMapHtml({
  jsApiKey,
  initialCenter,
  initialMarker,
}: KakaoMapHtmlParams): string {
  const marker = initialMarker ?? initialCenter;

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #e8eef7;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function () {
        var map = null;
        var marker = null;
        var geocoder = null;
        var geocodeTimer = null;
        var geocodeRequestId = 0;
        var pendingProgrammaticSource = null;

        var sdkKey = '${jsApiKey}';
        var sdkUrl = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + sdkKey + '&autoload=false&libraries=services';

        function post(type, payload) {
          if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
            return;
          }

          window.ReactNativeWebView.postMessage(
            JSON.stringify(Object.assign({ type: type }, payload || {}))
          );
        }

        function log(message, meta) {
          post('MAP_LOG', {
            keyType: 'JS',
            message: message,
            meta: meta || {},
          });
        }

        function round6(value) {
          return Number(value.toFixed(6));
        }

        function isSameCenter(aLat, aLng, bLat, bLng) {
          return Math.abs(aLat - bLat) <= 0.000002 && Math.abs(aLng - bLng) <= 0.000002;
        }

        post('MAP_BOOT', { href: String(window.location.href || '') });

        function emitMoved(lat, lng, address, roadAddress, jibunAddress, representativeJibun, source, reason) {
          post('MAP_MOVED', {
            lat: round6(lat),
            lng: round6(lng),
            address: address,
            roadAddress: roadAddress,
            jibunAddress: jibunAddress,
            representativeJibun: representativeJibun,
            source: source,
            reason: reason,
          });
        }

        function parseJibunParts(address) {
          var normalized = String(address || '').trim();
          if (!normalized) {
            return null;
          }
          var tokens = normalized.split(/\\s+/);
          if (tokens.length < 2) {
            return null;
          }
          var lotToken = tokens[tokens.length - 1];
          var lotMatch = lotToken.match(/^(\\d+)(?:-\\d+)?$/);
          if (!lotMatch || !lotMatch[1]) {
            return null;
          }
          var region = tokens.slice(0, -1).join(' ').trim();
          if (!region) {
            return null;
          }
          return {
            region: region,
            lotMain: lotMatch[1],
          };
        }

        function pickRepresentativeJibun(addresses) {
          var groups = {};
          addresses.forEach(function (address) {
            var parsed = parseJibunParts(address);
            if (!parsed) {
              return;
            }
            var key = parsed.region + ' ' + parsed.lotMain;
            groups[key] = (groups[key] || 0) + 1;
          });

          var selected = null;
          Object.keys(groups).forEach(function (key) {
            var count = groups[key];
            if (!selected || count > selected.count) {
              selected = { key: key, count: count };
            }
          });

          return selected ? selected.key : undefined;
        }

        function resolveRepresentativeJibun(lat, lng, requestId, done) {
          if (!geocoder || !geocoder.coord2Address || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
            done(undefined);
            return;
          }

          var offsets = [
            [0, 0],
            [0.00005, 0],
            [-0.00005, 0],
            [0, 0.00005],
            [0, -0.00005],
          ];

          var remaining = offsets.length;
          var addresses = [];

          offsets.forEach(function (offset) {
            var sampleLat = lat + offset[0];
            var sampleLng = lng + offset[1];

            geocoder.coord2Address(sampleLng, sampleLat, function (result, status) {
              if (requestId !== geocodeRequestId) {
                return;
              }

              if (status === window.kakao.maps.services.Status.OK && result && result[0]) {
                var sampleJibun = result[0].address && result[0].address.address_name
                  ? String(result[0].address.address_name).trim()
                  : '';
                if (sampleJibun) {
                  addresses.push(sampleJibun);
                }
              }

              remaining -= 1;
              if (remaining > 0) {
                return;
              }

              done(pickRepresentativeJibun(addresses));
            });
          });
        }

        function resolveAddress(lat, lng, reason) {
          if (!geocoder || !geocoder.coord2Address || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
            log('geocoder result', {
              ok: false,
              reason: reason,
              message: 'geocoder unavailable',
              lat: lat,
              lng: lng,
            });
            emitMoved(lat, lng, undefined, undefined, undefined, undefined, pendingProgrammaticSource || 'user', reason);
            pendingProgrammaticSource = null;
            return;
          }

          var currentRequestId = ++geocodeRequestId;
          geocoder.coord2Address(lng, lat, function (result, status) {
            if (currentRequestId !== geocodeRequestId) {
              return;
            }

            if (status !== window.kakao.maps.services.Status.OK || !result || !result[0]) {
              log('geocoder result', {
                ok: false,
                reason: reason,
                status: status,
                lat: lat,
                lng: lng,
              });
              emitMoved(lat, lng, undefined, undefined, undefined, undefined, pendingProgrammaticSource || 'user', reason);
              pendingProgrammaticSource = null;
              return;
            }

            var roadAddress = result[0].road_address && result[0].road_address.address_name
              ? String(result[0].road_address.address_name).trim()
              : '';
            var jibunAddress = result[0].address && result[0].address.address_name
              ? String(result[0].address.address_name).trim()
              : '';
            var resolvedAddress = roadAddress || jibunAddress || undefined;

            log('geocoder result', {
              ok: true,
              reason: reason,
              lat: lat,
              lng: lng,
              address: resolvedAddress,
            });

            resolveRepresentativeJibun(lat, lng, currentRequestId, function (representativeJibun) {
              if (currentRequestId !== geocodeRequestId) {
                return;
              }

              log('representative jibun result', {
                reason: reason,
                lat: lat,
                lng: lng,
                representativeJibun: representativeJibun || null,
              });

              emitMoved(
                lat,
                lng,
                resolvedAddress,
                roadAddress || undefined,
                jibunAddress || undefined,
                representativeJibun || undefined,
                pendingProgrammaticSource || 'user',
                reason,
              );
              pendingProgrammaticSource = null;
            });
          });
        }

        function queueCenterResolve(reason) {
          if (!map) {
            return;
          }

          if (geocodeTimer) {
            clearTimeout(geocodeTimer);
          }

          geocodeTimer = setTimeout(function () {
            if (!map) {
              return;
            }

            var center = map.getCenter();
            resolveAddress(center.getLat(), center.getLng(), reason);
          }, 140);
        }

        function initMap() {
          try {
            var container = document.getElementById('map');
            if (!container) {
              post('MAP_ERROR', { message: 'map container not found' });
              return;
            }

            var center = new kakao.maps.LatLng(${initialCenter.lat}, ${initialCenter.lng});
            map = new kakao.maps.Map(container, {
              center: center,
              level: 3,
            });

            marker = new kakao.maps.Marker({
              position: new kakao.maps.LatLng(${marker.lat}, ${marker.lng}),
            });
            marker.setMap(map);

            if (kakao.maps.services && kakao.maps.services.Geocoder) {
              geocoder = new kakao.maps.services.Geocoder();
            }

            window.moveTo = function (lat, lng, source) {
              if (!map) {
                post('MAP_ERROR', { message: 'map is not initialized' });
                return;
              }

              pendingProgrammaticSource = source || 'gps';

              var next = new kakao.maps.LatLng(lat, lng);
              map.setCenter(next);

              if (marker) {
                marker.setPosition(next);
              }

              queueCenterResolve('programmatic');
            };

            kakao.maps.event.addListener(map, 'dragend', function () {
              queueCenterResolve('dragend');
            });

            kakao.maps.event.addListener(map, 'zoom_changed', function () {
              queueCenterResolve('zoom_changed');
            });

            queueCenterResolve('init');

            log('map init success', {
              center: {
                lat: ${initialCenter.lat},
                lng: ${initialCenter.lng},
              },
            });
            post('MAP_READY');
          } catch (error) {
            post('MAP_ERROR', {
              message: String(error && error.message ? error.message : error),
            });
          }
        }

        function removeSdkScriptByKey(key) {
          var scripts = document.querySelectorAll('script[data-kakao-map-sdk-key]');
          scripts.forEach(function (script) {
            if (script.getAttribute('data-kakao-map-sdk-key') === key) {
              script.parentNode && script.parentNode.removeChild(script);
            }
          });
        }

        function ensureSdkLoaded(maxRetry, attempt) {
          var currentAttempt = attempt || 1;

          log('SDK load start', {
            keyType: 'JS',
            attempt: currentAttempt,
          });

          if (window.kakao && window.kakao.maps && window.kakao.maps.load) {
            window.kakao.maps.load(function () {
              log('SDK load success', {
                keyType: 'JS',
                attempt: currentAttempt,
                reused: true,
              });
              initMap();
            });
            return;
          }

          var existing = document.querySelector('script[data-kakao-map-sdk-key="' + sdkKey + '"]');
          if (!existing) {
            existing = document.createElement('script');
            existing.src = sdkUrl;
            existing.async = true;
            existing.setAttribute('data-kakao-map-sdk-key', sdkKey);
            document.head.appendChild(existing);
          }

          existing.onload = function () {
            if (!window.kakao || !window.kakao.maps || !window.kakao.maps.load) {
              if (currentAttempt >= maxRetry) {
                log('SDK load fail', {
                  keyType: 'JS',
                  attempt: currentAttempt,
                  message: 'kakao.maps.load unavailable after script load',
                });
                post('MAP_ERROR', { message: 'kakao maps load unavailable after sdk script load' });
                return;
              }

              removeSdkScriptByKey(sdkKey);
              ensureSdkLoaded(maxRetry, currentAttempt + 1);
              return;
            }

            window.kakao.maps.load(function () {
              log('SDK load success', {
                keyType: 'JS',
                attempt: currentAttempt,
                reused: false,
              });
              initMap();
            });
          };

          existing.onerror = function () {
            log('SDK load fail', {
              keyType: 'JS',
              attempt: currentAttempt,
              message: 'failed to load kakao maps sdk script',
              sdkUrl: sdkUrl,
              locationHref: String(window.location.href || ''),
              origin: String(window.location.origin || ''),
            });

            if (currentAttempt >= maxRetry) {
              post('MAP_ERROR', {
                message:
                  'failed to load kakao maps sdk script; url=' +
                  sdkUrl +
                  '; online=' +
                  String(navigator.onLine) +
                  '; href=' +
                  String(window.location.href || '') +
                  '; origin=' +
                  String(window.location.origin || ''),
              });
              return;
            }

            removeSdkScriptByKey(sdkKey);
            ensureSdkLoaded(maxRetry, currentAttempt + 1);
          };
        }

        window.addEventListener('error', function (event) {
          post('MAP_ERROR', {
            message: String(event && event.message ? event.message : 'webview runtime error'),
          });
        });

        ensureSdkLoaded(3, 1);
      })();
    </script>
  </body>
</html>`;
}
