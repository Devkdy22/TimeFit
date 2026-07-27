import { sliceBusRoutePath } from '../../model/routePrewarmGeometry';

describe('sliceBusRoutePath', () => {
  const path = [
    { lat: 37.5, lng: 127.0 },
    { lat: 37.51, lng: 127.01 },
    { lat: 37.52, lng: 127.02 },
    { lat: 37.53, lng: 127.03 },
  ];

  it('keeps the bus route direction between matched stops', () => {
    expect(sliceBusRoutePath(path, path[1], path[3])).toEqual(path.slice(1));
  });

  it('reverses the path when the route is traversed in the opposite direction', () => {
    expect(sliceBusRoutePath(path, path[3], path[1])).toEqual(path.slice(1, 4).reverse());
  });

  it('does not invent a slice when stop coordinates are unavailable', () => {
    expect(sliceBusRoutePath(path, null, path[2])).toEqual(path);
  });
});
