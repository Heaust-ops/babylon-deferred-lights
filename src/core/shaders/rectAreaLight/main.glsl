

in vec2 vUV;
uniform int lights_len;
uniform vec2 screenSize;
uniform vec3 camera_position;
uniform mat4 view;

const float LUT_SIZE  = 64.0;
const float LUT_SCALE = (LUT_SIZE - 1.0)/LUT_SIZE;
const float LUT_BIAS  = 0.5/LUT_SIZE;

const float pi = 3.14159265;

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
uniform sampler2D ltc_1;
uniform sampler2D ltc_2;

vec3 rotatePointByQuaternion(vec3 p, vec4 q) {
    vec3 u = q.xyz;
    float s = q.w;

    return 2.0 * dot(u, p) * u 
           + (s * s - dot(u, u)) * p 
           + 2.0 * s * cross(u, p);
}

vec3 transformPlanePoint(vec3 localPoint, vec3 position, vec2 scale, vec4 quaternion) {
    vec3 scaledPoint = vec3(localPoint.x * scale.x, localPoint.y * scale.y, localPoint.z);
    vec3 rotatedPoint = rotatePointByQuaternion(scaledPoint, quaternion);
    return rotatedPoint + position;
}

#include ./ltc.glsl;
#include ./miscHelpers.glsl;

vec3 getColor (
    vec4 quaternion,
    vec2 scaling,
    bool isTwoSided,
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

    float rangeClampFactor = light_range == 0.0 ? 1.0 : smoothstep(light_range, light_range - 0.1, r);
    if (rangeClampFactor == 0.) return vec3(0.);
    
    vec3 l = d / r;
    vec3 N = normals.rgb;

    float roughness = 1.0 - refl.a;
    float metalness = refl.b;

    vec3 points[4];
    
    points[0] = vec3(-0.5, -0.5, 0.0);
    points[1] = vec3(0.5, -0.5, 0.0);
    points[2] = vec3(0.5, 0.5, 0.0);
    points[3] = vec3(-0.5, 0.5, 0.0);
    
    for (int i = 0; i < 4; i++) {
        points[i] = transformPlanePoint(points[i], light_p, scaling, quaternion);
    }

    vec4 floorPlane = vec4(0, 1, 0, 0);

    vec3 lcol = vec3(intensity) * light_color;
    vec3 dcol = ToLinear(vec3(1.));
    vec3 scol = ToLinear(vec3(1.));

    vec3 col = vec3(0);
    
    vec3 pos = p0.rgb;
    vec3 V = normalize(camera_position - p0.rgb);

    float ndotv = saturate(dot(N, V));
    
    vec2 uv = vec2(roughness, sqrt(1.0 - ndotv));
    
    uv = uv*LUT_SCALE + LUT_BIAS;

    vec4 t1 = texture(ltc_1, uv);
    vec4 t2 = texture(ltc_2, uv);

    mat3 Minv = mat3(
        vec3(t1.x, 0, t1.y),
        vec3(  0,  1,    0),
        vec3(t1.z, 0, t1.w)
    );

    vec3 spec = LTC_Evaluate(N, V, pos, Minv, points, isTwoSided);
    
    // BRDF shadowing and Fresnel
    spec *= scol*t2.x + (1.0 - scol)*t2.y;

    vec3 diff = LTC_Evaluate(N, V, pos, mat3(1), points, isTwoSided);

    col = lcol*(spec + dcol*diff);
    
    return col;
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
            quaternion,
            scaling,
            isTwoSided,
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

