import { buildKakaoMapHtml } from './html';

describe('Kakao map route progress contract', () => {
  it('uses distance-weighted geometry slicing for the traveled route line', () => {
    const html = buildKakaoMapHtml({
      jsApiKey: 'test-key',
      initialCenter: { lat: 37.5, lng: 127 },
    });

    expect(html).toContain('function distanceBetweenPoints(a, b)');
    expect(html).toContain('var targetDistance = totalDistance * progress;');
    expect(html).toContain('var progressPoints = [points[0]];');
    expect(html).not.toContain('Math.ceil((points.length - 1) * progress)');
  });
});
