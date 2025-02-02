vec4 ci = lights_color_intensity[i];
vec4 pr = lights_position_range[i];

vec4 quaternion = lights_quaternion[i];
vec3 sclIs2 = lights_scaling_etal[i];

vec2 scaling = sclIs2.xy;
bool isTwoSided = sclIs2.z > 0.5;
