float texIndex = (float(i) / TOTAL_LIGHTS_ALLOWED);
vec4 ci = texture2D(point_lights_data, vec2(texIndex, 0.0 / POINTS_DATA_TEXTURE_HEIGHT));
vec4 px = texture2D(point_lights_data, vec2(texIndex, 1.001 / POINTS_DATA_TEXTURE_HEIGHT)) * 255.0;
vec4 py = texture2D(point_lights_data, vec2(texIndex, 2.001 / POINTS_DATA_TEXTURE_HEIGHT)) * 255.0;
vec4 pz = texture2D(point_lights_data, vec2(texIndex, 3.001 / POINTS_DATA_TEXTURE_HEIGHT)) * 255.0;
vec4 range = texture2D(point_lights_data, vec2(texIndex, 1.0)) * 255.0;

float true_px = assembleNumber(int(px.r), int(px.g), int(px.b), int(px.a));
float true_py = assembleNumber(int(py.r), int(py.g), int(py.b), int(py.a));
float true_pz = assembleNumber(int(pz.r), int(pz.g), int(pz.b), int(pz.a));
float true_range = assembleNumber(int(range.r), int(range.g), int(range.b), int(range.a));
