const { percentEncode } = require('../src');

describe('percentEncode', () => {
  it('encodes reserved characters', () => {
    expect(percentEncode("a b!'()*")).toBe('a%20b%21%27%28%29%2A');
  });

  it('matches the RFC 5849 normalized string', function () {
    const { baseString } = this.referenceSignature(this.rfcExample);
    expect(baseString).toContain('POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b');
  });
});
