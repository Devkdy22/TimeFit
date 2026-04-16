import type { MapCoordinate } from '../types';

interface KakaoMapHtmlParams {
  apiKey: string;
  initialCenter: MapCoordinate;
  initialMarker?: MapCoordinate;
}

export function buildKakaoMapHtml({
  apiKey,
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
        var sdkUrl = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services';

        function post(type, payload) {
          if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
            return;
          }

          window.ReactNativeWebView.postMessage(
            JSON.stringify(Object.assign({ type: type }, payload || {}))
          );
        }

        post('MAP_BOOT', { href: String(window.location.href || '') });

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

            var geocoder = null;
            if (kakao.maps.services && kakao.maps.services.Geocoder) {
              geocoder = new kakao.maps.services.Geocoder();
            }

            var geocodeTimer = null;

            function emitCenter(lat, lng) {
              post('MAP_MOVED', { lat: lat, lng: lng });

              if (!geocoder || !geocoder.coord2Address) {
                return;
              }

              geocoder.coord2Address(lng, lat, function (result, status) {
                if (status !== kakao.maps.services.Status.OK || !result || !result[0]) {
                  return;
                }

                var roadAddress = result[0].road_address && result[0].road_address.address_name
                  ? result[0].road_address.address_name
                  : '';
                var jibunAddress = result[0].address && result[0].address.address_name
                  ? result[0].address.address_name
                  : '';
                var resolvedAddress = roadAddress || jibunAddress;

                if (!resolvedAddress) {
                  return;
                }

                post('MAP_MOVED', { lat: lat, lng: lng, address: resolvedAddress });
              });
            }

            function queueCenterResolve() {
              if (!map) {
                return;
              }

              if (geocodeTimer) {
                clearTimeout(geocodeTimer);
              }

              geocodeTimer = setTimeout(function () {
                var center = map.getCenter();
                emitCenter(center.getLat(), center.getLng());
              }, 170);
            }

            window.moveTo = function (lat, lng) {
              if (!map) {
                post('MAP_ERROR', { message: 'map is not initialized' });
                return;
              }

              var next = new kakao.maps.LatLng(lat, lng);
              map.setCenter(next);

              if (marker) {
                marker.setPosition(next);
              }

              queueCenterResolve();
            };

            kakao.maps.event.addListener(map, 'dragend', queueCenterResolve);
            kakao.maps.event.addListener(map, 'zoom_changed', queueCenterResolve);

            queueCenterResolve();

            post('MAP_READY');
          } catch (error) {
            post('MAP_ERROR', {
              message: String(error && error.message ? error.message : error),
            });
          }
        }

        function loadSdk() {
          var script = document.createElement('script');
          script.src = sdkUrl;
          script.async = true;
          script.onload = function () {
            if (!window.kakao || !window.kakao.maps || !window.kakao.maps.load) {
              post('MAP_ERROR', { message: 'kakao maps sdk loaded but kakao.maps is unavailable' });
              return;
            }

            window.kakao.maps.load(initMap);
          };
          script.onerror = function () {
            post('MAP_ERROR', {
              message: 'failed to load kakao maps sdk script; url=' + sdkUrl + '; online=' + String(navigator.onLine),
            });
          };

          document.head.appendChild(script);
        }

        window.addEventListener('error', function (event) {
          post('MAP_ERROR', {
            message: String(event && event.message ? event.message : 'webview runtime error'),
          });
        });

        loadSdk();
      })();
    </script>
  </body>
</html>`;
}
