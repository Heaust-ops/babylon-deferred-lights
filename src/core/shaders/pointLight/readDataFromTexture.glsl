
float pixelStart = float(i * 2);

// pixel start
float startX0 = floor(mod(pixelStart,  POINTS_DATA_TEXTURE_WIDTH));
float startY0 = floor(pixelStart / POINTS_DATA_TEXTURE_WIDTH);

// the next pixel
float startX1 = floor(mod(pixelStart + 1.,  POINTS_DATA_TEXTURE_WIDTH));
float startY1 = floor((pixelStart + 1.) / POINTS_DATA_TEXTURE_WIDTH);

vec2 ciCoords = vec2(startX0, startY0);
vec2 prCoords = vec2(startX1, startY1);

vec4 ci = texture2D(point_lights_data, ciCoords);
vec4 pr = texture2D(point_lights_data, prCoords);

float true_px = pr.x;
float true_py = pr.y;
float true_pz = pr.z;
float true_range = pr.w;
