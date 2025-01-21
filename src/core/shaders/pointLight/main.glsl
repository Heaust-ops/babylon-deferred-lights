

in vec2 vUV;
uniform int lights_len;
uniform vec2 screenSize;
uniform vec3 camera_position;


#ifdef IS_PERFORMANCE_MODE
  uniform vec4 lights_position_range[TOTAL_PERFORMANCE_LIGHTS_ALLOWED];
  uniform vec4 lights_color_intensity[TOTAL_PERFORMANCE_LIGHTS_ALLOWED];
#else
  uniform sampler2D point_lights_data;
#endif

uniform sampler2D textureSampler;
uniform sampler2D nBuffer;
uniform sampler2D pBuffer;
uniform sampler2D rBuffer;

#include ./brdfMicrofacet;

vec3 getColor (
    float intensity,
    vec3 light_p,
    vec3 light_color,
    float light_range,
    vec4 color,
    vec4 normals,
    vec4 p0,
    vec4 refl
) {
    vec3 d = light_p - p0.rgb;
    float r = length(d);
    vec3 l = d / r;
    vec3 n = normals.rgb;

    float normalFactor = pow(max(0.0, dot(n, l)), 2.0);
    float distanceFactor = clamp(pow( intensity / r , 2.0), 0.0, 1.0);
    float mixFactor = distanceFactor * normalFactor;
    float rangeClampFactor = light_range == 0.0 ? 1.0 : smoothstep(light_range, light_range - 0.1, r);
    vec3 final_standard = max(vec3(0.0), light_color * clamp(mixFactor, 0.0, 1.0)) * rangeClampFactor;

    float roughness = 1.0 - refl.a;
    float metalness = refl.b;
    
    if (roughness == 0.0) {
        return final_standard;
    }

    vec3 v = normalize(camera_position - p0.rgb);
    
    return brdfMicrofacets(l, v, normalize(n), metalness, roughness, color.rgb * light_color, 0.5) * rangeClampFactor;
}

void main(void) {
    vec4 normals = texture2D(nBuffer, vUV);
    vec4 color = texture2D(textureSampler, vUV);
    if (normals.a == 0.0) {
        gl_FragColor = color;
        return;
    }

    vec4 pbuff = texture2D(pBuffer, vUV);
    vec4 refl = texture2D(rBuffer, vUV);

    for (int i = 0; i < lights_len; i++) {
        #ifdef IS_PERFORMANCE_MODE
          #include ./readDataFromUniforms;
        #else
          #include ./readDataFromTexture;
        #endif

        color.rgb += getColor(
            abs(ci.a * 10.0),
            pr.xyz,
            normalize(ci.rgb),
            pr.w,
            color,
            normals,
            pbuff,
            refl
        );
    }
    
    gl_FragColor = color;
}

