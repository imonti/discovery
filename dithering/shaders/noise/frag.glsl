precision mediump float;

uniform sampler2D uTexture;
uniform sampler2D noiseTexture;
uniform float noiseTextureSize;
uniform vec2 smoothstepThreshold;
uniform float clipThreshold;

in vec2 vUv;
out vec4 fragColor;

const float BAYER8[64] = float[](
  0.,32., 8.,40., 2.,34.,10.,42.,
  48.,16.,56.,24.,50.,18.,58.,26.,
  12.,44., 4.,36.,14.,46., 6.,38.,
  60.,28.,52.,20.,62.,30.,54.,22.,
  3.,35.,11.,43., 1.,33., 9.,41.,
  51.,19.,59.,27.,49.,17.,57.,25.,
  15.,47., 7.,39.,13.,45., 5.,37.,
  63.,31.,55.,23.,61.,29.,53.,21.
);

const float BAYER4[16] = float[](
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0
);

float bayer8(vec2 p)
{
    int x = int(mod(p.x, 8.0));
    int y = int(mod(p.y, 8.0));
    int index = x + y * 8;
    return BAYER8[index] / 64.0;
}

float bayer4(vec2 p)
{
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int index = x + y * 4;
    return BAYER4[index] / 16.0;
}

float textureDithering(vec2 fragmentCoord)
{
    vec2 sampleUv = fract(fragmentCoord / noiseTextureSize);
    return texture(noiseTexture, sampleUv).r;
}
float quadraticOut(float x)
{
    return 1.0 - (1.0 - x) * (1.0 - x);
}

void main() {
  vec4 texel = texture(uTexture, vUv);
  
  #if DITHER_MODE == 1
    float threshold = bayer4(gl_FragCoord.xy);
  #elif DITHER_MODE == 2
    float threshold = bayer8(gl_FragCoord.xy);
  #elif DITHER_MODE >= 3 && DITHER_MODE <= 9
    float threshold = textureDithering(gl_FragCoord.xy);
  #else
    float threshold = 0.0;
  #endif

  float easedAlpha = smoothstep(smoothstepThreshold.x, smoothstepThreshold.y, texel.a);
  // easedAlpha = quadraticOut(remap(texel.a, 0.0, 0.3));
  if (texel.a < clipThreshold || easedAlpha < threshold) {
    discard;
  }

  fragColor = vec4(texel.rgb, 1.0);
}
