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
        var originMarker = null;
        var destinationMarker = null;
        var routePolyline = null;
        var routeOutlinePolyline = null;
        var routeSegmentPolylines = [];
        var routeTransferMarkers = [];
        var traveledPolyline = null;
        var traveledOutlinePolyline = null;
        var routeBounds = null;
        var geocoder = null;
        var geocodeTimer = null;
        var geocodeRequestId = 0;
        var pendingProgrammaticSource = null;
        var lockedGpsPosition = {
          lat: ${marker.lat},
          lng: ${marker.lng},
        };

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

        function isValidCoordinate(point) {
          return (
            point &&
            typeof point.lat === 'number' &&
            typeof point.lng === 'number' &&
            Math.abs(point.lat) <= 90 &&
            Math.abs(point.lng) <= 180
          );
        }

        function isWithinKorea(point) {
          if (!isValidCoordinate(point)) {
            return false;
          }
          return point.lat >= 33 && point.lat <= 39.5 && point.lng >= 124 && point.lng <= 132;
        }

        function toLatLngPath(points) {
          if (!window.kakao || !window.kakao.maps || !Array.isArray(points)) {
            return [];
          }

          var normalized = points
            .filter(isValidCoordinate)
            .filter(function (point, index, arr) {
              if (index === 0) {
                return true;
              }
              var prev = arr[index - 1];
              return Math.abs(prev.lat - point.lat) > 0.000001 || Math.abs(prev.lng - point.lng) > 0.000001;
            });

          return normalized.map(function (point) {
            return new kakao.maps.LatLng(point.lat, point.lng);
          });
        }

        function clearRoutePolyline() {
          if (routePolyline) {
            routePolyline.setMap(null);
            routePolyline = null;
          }
          if (routeOutlinePolyline) {
            routeOutlinePolyline.setMap(null);
            routeOutlinePolyline = null;
          }
          routeBounds = null;
        }

        function clearSegmentPolylines() {
          routeSegmentPolylines.forEach(function (item) {
            if (item && item.main) {
              item.main.setMap(null);
            }
            if (item && item.outline) {
              item.outline.setMap(null);
            }
          });
          routeSegmentPolylines = [];
          routeTransferMarkers.forEach(function (item) {
            if (item && item.setMap) {
              item.setMap(null);
            }
          });
          routeTransferMarkers = [];
        }

        function clearTraveledPolyline() {
          if (traveledPolyline) {
            traveledPolyline.setMap(null);
            traveledPolyline = null;
          }
          if (traveledOutlinePolyline) {
            traveledOutlinePolyline.setMap(null);
            traveledOutlinePolyline = null;
          }
        }

        function fitMapToRoute() {
          if (!map || !window.kakao || !window.kakao.maps || !window.kakao.maps.LatLngBounds) {
            return;
          }

          var bounds = new kakao.maps.LatLngBounds();
          var hasAnyPoint = false;

          if (routeBounds) {
            bounds.extend(routeBounds.getSouthWest());
            bounds.extend(routeBounds.getNorthEast());
            hasAnyPoint = true;
          }
          if (originMarker && originMarker.getPosition) {
            bounds.extend(originMarker.getPosition());
            hasAnyPoint = true;
          }
          if (destinationMarker && destinationMarker.getPosition) {
            bounds.extend(destinationMarker.getPosition());
            hasAnyPoint = true;
          }

          if (hasAnyPoint) {
            map.setBounds(bounds, 72, 40, 260, 40);
          }
        }

        function styleBySegment(segment) {
          var isWalk = segment && segment.mode === 'WALK';
          return {
            color: (segment && segment.color) || (isWalk ? '#8A8F98' : '#2D7FF9'),
            outerWeight: 10,
            innerWeight: 6,
            innerStyle: isWalk ? 'shortdash' : 'solid',
            zIndex: segment && typeof segment.zIndex === 'number' ? segment.zIndex : (isWalk ? 20 : 30),
          };
        }

        post('MAP_BOOT', { href: String(window.location.href || '') });

        function emitMoved(lat, lng, address, roadAddress, jibunAddress, representativeJibun, source, reason) {
          var emitLat = lat;
          var emitLng = lng;

          // GPS 소스는 geocoder 좌표 대신 GPS 원본 좌표를 단일 진실 소스로 유지한다.
          if ((source === 'gps' || reason === 'init' || reason === 'programmatic') && lockedGpsPosition) {
            emitLat = lockedGpsPosition.lat;
            emitLng = lockedGpsPosition.lng;
          }

          post('MAP_MOVED', {
            lat: round6(emitLat),
            lng: round6(emitLng),
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

            var timiSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#58C7C2" stroke="#FFFFFF" stroke-width="3"/></svg>';
            var timiImage = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(timiSvg);
            var markerImage = null;
            if (kakao.maps.MarkerImage && kakao.maps.Size && kakao.maps.Point) {
              markerImage = new kakao.maps.MarkerImage(
                timiImage,
                new kakao.maps.Size(24, 24),
                { offset: new kakao.maps.Point(12, 12) }
              );
            }

            marker = new kakao.maps.Marker({
              position: new kakao.maps.LatLng(${marker.lat}, ${marker.lng}),
              image: markerImage || undefined,
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
              if (pendingProgrammaticSource === 'gps') {
                lockedGpsPosition = { lat: lat, lng: lng };
              }

              var next = new kakao.maps.LatLng(lat, lng);
              map.setCenter(next);

              if (marker && pendingProgrammaticSource === 'gps') {
                marker.setPosition(next);
              }

              queueCenterResolve('programmatic');
            };

            window.moveMarker = function (lat, lng) {
              if (!marker) {
                return;
              }
              marker.setPosition(new kakao.maps.LatLng(lat, lng));
              lockedGpsPosition = { lat: lat, lng: lng };
            };

            window.setRoutePath = function (points) {
              if (!map) {
                return;
              }

              clearSegmentPolylines();
              var latLngPath = toLatLngPath(points);

              if (latLngPath.length < 2) {
                clearRoutePolyline();
                return;
              }

              clearRoutePolyline();

              routeOutlinePolyline = new kakao.maps.Polyline({
                path: latLngPath,
                strokeWeight: 10,
                strokeColor: '#FFFFFF',
                strokeOpacity: 0.86,
                strokeStyle: 'solid',
              });
              routeOutlinePolyline.setMap(map);

              routePolyline = new kakao.maps.Polyline({
                path: latLngPath,
                strokeWeight: 6,
                strokeColor: '#4ECFC7',
                strokeOpacity: 0.9,
                strokeStyle: 'solid',
              });
              routePolyline.setMap(map);

              routeBounds = new kakao.maps.LatLngBounds();
              latLngPath.forEach(function (point) {
                routeBounds.extend(point);
              });
              fitMapToRoute();
            };

            window.setRouteSegments = function (segments) {
              if (!map || !Array.isArray(segments)) {
                return;
              }

              clearSegmentPolylines();
              clearRoutePolyline();

              var orderedSegments = segments.slice().sort(function (a, b) {
                var zA = a && typeof a.zIndex === 'number' ? a.zIndex : 0;
                var zB = b && typeof b.zIndex === 'number' ? b.zIndex : 0;
                return zA - zB;
              });
              var hasAnyBoundsPoint = false;
              var nextBounds = new kakao.maps.LatLngBounds();

              orderedSegments.forEach(function (segment, segmentIndex) {
                var latLngPath = toLatLngPath(segment && Array.isArray(segment.polyline) ? segment.polyline : []);
                if (latLngPath.length < 2) {
                  return;
                }

                var style = styleBySegment(segment);
                var outline = new kakao.maps.Polyline({
                  path: latLngPath,
                  strokeWeight: style.outerWeight,
                  strokeColor: '#FFFFFF',
                  strokeOpacity: 0.95,
                  strokeStyle: 'solid',
                  zIndex: style.zIndex,
                });
                outline.setMap(map);

                var main = new kakao.maps.Polyline({
                  path: latLngPath,
                  strokeWeight: style.innerWeight,
                  strokeColor: style.color,
                  strokeOpacity: 1,
                  strokeStyle: style.innerStyle,
                  zIndex: style.zIndex + 1,
                });
                main.setMap(map);

                routeSegmentPolylines.push({ outline: outline, main: main });

                var rawPoints = Array.isArray(segment.polyline) ? segment.polyline : [];
                if (rawPoints.length >= 2) {
                  rawPoints.forEach(function (rawPoint) {
                    if (!isWithinKorea(rawPoint)) {
                      return;
                    }
                    if (rawPoint.lat === 0 || rawPoint.lng === 0) {
                      return;
                    }
                    nextBounds.extend(new kakao.maps.LatLng(rawPoint.lat, rawPoint.lng));
                    hasAnyBoundsPoint = true;
                  });
                }

                if (segmentIndex > 0 && rawPoints.length > 0) {
                  var transferPoint = rawPoints[0];
                  if (isWithinKorea(transferPoint) && transferPoint.lat !== 0 && transferPoint.lng !== 0) {
                    var transferSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.2" fill="#FFD166" stroke="#FFFFFF" stroke-width="2.4"/><circle cx="8" cy="8" r="1.6" fill="#FFFFFF"/></svg>';
                    var transferImage = null;
                    if (kakao.maps.MarkerImage && kakao.maps.Size && kakao.maps.Point) {
                      transferImage = new kakao.maps.MarkerImage(
                        'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(transferSvg),
                        new kakao.maps.Size(16, 16),
                        { offset: new kakao.maps.Point(8, 8) }
                      );
                    }
                    var transferMarker = new kakao.maps.Marker({
                      position: new kakao.maps.LatLng(transferPoint.lat, transferPoint.lng),
                      image: transferImage || undefined,
                      zIndex: style.zIndex + 2,
                    });
                    transferMarker.setMap(map);
                    routeTransferMarkers.push(transferMarker);
                  }
                }
              });

              if (hasAnyBoundsPoint) {
                routeBounds = nextBounds;
                fitMapToRoute();
              } else {
                routeBounds = null;
              }
            };

            window.setTraveledPath = function (points) {
              if (!map) {
                return;
              }
              var latLngPath = toLatLngPath(points);
              if (latLngPath.length < 2) {
                clearTraveledPolyline();
                return;
              }

              clearTraveledPolyline();
              traveledOutlinePolyline = new kakao.maps.Polyline({
                path: latLngPath,
                strokeWeight: 11,
                strokeColor: '#FFFFFF',
                strokeOpacity: 0.9,
                strokeStyle: 'solid',
              });
              traveledOutlinePolyline.setMap(map);

              traveledPolyline = new kakao.maps.Polyline({
                path: latLngPath,
                strokeWeight: 8,
                strokeColor: '#1FAFA7',
                strokeOpacity: 0.98,
                strokeStyle: 'solid',
              });
              traveledPolyline.setMap(map);
            };

            window.setPins = function (pins) {
              if (!map || !pins) {
                return;
              }

              if (originMarker) {
                originMarker.setMap(null);
                originMarker = null;
              }
              if (destinationMarker) {
                destinationMarker.setMap(null);
                destinationMarker = null;
              }

              if (pins.origin && typeof pins.origin.lat === 'number' && typeof pins.origin.lng === 'number') {
                var originSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M17 1C8.7 1 2 7.7 2 16c0 11.1 12.2 22.1 14.1 23.8a1.4 1.4 0 0 0 1.8 0C19.8 38.1 32 27.1 32 16 32 7.7 25.3 1 17 1z" fill="#3E88FF" stroke="#2A63C9" stroke-width="1.2"/><circle cx="17" cy="16" r="6.2" fill="#fff"/><circle cx="17" cy="16" r="2.8" fill="#3E88FF"/></svg>';
                var originImage = null;
                if (kakao.maps.MarkerImage && kakao.maps.Size && kakao.maps.Point) {
                  originImage = new kakao.maps.MarkerImage(
                    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(originSvg),
                    new kakao.maps.Size(34, 42),
                    { offset: new kakao.maps.Point(17, 41) }
                  );
                }
                originMarker = new kakao.maps.Marker({
                  position: new kakao.maps.LatLng(pins.origin.lat, pins.origin.lng),
                  image: originImage || undefined,
                });
                originMarker.setMap(map);
              }

              if (
                pins.destination &&
                typeof pins.destination.lat === 'number' &&
                typeof pins.destination.lng === 'number'
              ) {
                var destinationSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M17 1C8.7 1 2 7.7 2 16c0 11.1 12.2 22.1 14.1 23.8a1.4 1.4 0 0 0 1.8 0C19.8 38.1 32 27.1 32 16 32 7.7 25.3 1 17 1z" fill="#EF4444" stroke="#B91C1C" stroke-width="1.2"/><circle cx="17" cy="16" r="6.2" fill="#fff"/><circle cx="17" cy="16" r="2.8" fill="#EF4444"/></svg>';
                var destinationImage = null;
                if (kakao.maps.MarkerImage && kakao.maps.Size && kakao.maps.Point) {
                  destinationImage = new kakao.maps.MarkerImage(
                    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(destinationSvg),
                    new kakao.maps.Size(34, 42),
                    { offset: new kakao.maps.Point(17, 41) }
                  );
                }
                destinationMarker = new kakao.maps.Marker({
                  position: new kakao.maps.LatLng(pins.destination.lat, pins.destination.lng),
                  image: destinationImage || undefined,
                });
                destinationMarker.setMap(map);
              }

              fitMapToRoute();
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
