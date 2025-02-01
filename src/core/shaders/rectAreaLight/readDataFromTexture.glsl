
float pixelStart = float(i) * 2.;

vec2 fullPixelStep = vec2(1. / POINTS_DATA_TEXTURE_WIDTH, 1. / POINTS_DATA_TEXTURE_HEIGHT);

// pixel start
float startX0 = floor(mod(pixelStart,  POINTS_DATA_TEXTURE_WIDTH));
float startY0 = floor(pixelStart / POINTS_DATA_TEXTURE_WIDTH);

// the next pixel
pixelStart += 1.;
float startX1 = floor(mod(pixelStart,  POINTS_DATA_TEXTURE_WIDTH));
float startY1 = floor(pixelStart / POINTS_DATA_TEXTURE_WIDTH);

// the next pixel
pixelStart += 1.;
float startX2 = floor(mod(pixelStart,  POINTS_DATA_TEXTURE_WIDTH));
float startY2 = floor(pixelStart / POINTS_DATA_TEXTURE_WIDTH);

// the next pixel
pixelStart += 1.;
float startX3 = floor(mod(pixelStart,  POINTS_DATA_TEXTURE_WIDTH));
float startY3 = floor(pixelStart / POINTS_DATA_TEXTURE_WIDTH);

vec2 ciCoords = vec2(startX0, startY0) * fullPixelStep;
vec2 prCoords = vec2(startX1, startY1) * fullPixelStep;
vec2 qCoords = vec2(startX2, startY2) * fullPixelStep;
vec2 sclCoords = vec2(startX3, startY3) * fullPixelStep;

vec4 ci = texture2D(point_lights_data, ciCoords);
vec4 pr = texture2D(point_lights_data, prCoords);

vec4 quaternion = texture2D(point_lights_data, qCoords);
vec4 sclIs2 = texture2D(point_lights_data, sclCoords);

vec2 scaling = sclIs2.xy;
bool isTwoSided = sclIs2.z > 0.5;
