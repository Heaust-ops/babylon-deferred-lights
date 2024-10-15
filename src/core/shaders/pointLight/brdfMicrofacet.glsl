// https://www.youtube.com/watch?v=gya7x9H3mV0
// https://www.gsn-lib.org/index.html#projectName=ShadersMonthly09&graphName=MicrofacetBRDF

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float D_GGX(float NoH, float roughness) {
    float alpha = roughness * roughness;
    float alpha2 = alpha * alpha;
    float NoH2 = NoH * NoH;
    float b = (NoH2 * (alpha2 - 1.0) + 1.0);
    return alpha2 * RECIPROCAL_PI / (b * b);
}

float G1_GGX_Schlick(float NoV, float roughness) {
    float alpha = roughness * roughness;
    float k = alpha / 2.0;
    return max(NoV, 0.001) / (NoV * (1.0 - k) + k);
}

float G_Smith(float NoV, float NoL, float roughness) {
    return G1_GGX_Schlick(NoL, roughness) * G1_GGX_Schlick(NoV, roughness);
}

float fresnelSchlick90(float cosTheta, float F0, float F90) {
    return F0 + (F90 - F0) * pow(1.0 - cosTheta, 5.0);
} 

float disneyDiffuseFactor(float NoV, float NoL, float VoH, float roughness) {
    float alpha = roughness * roughness;
    float F90 = 0.5 + 2.0 * alpha * VoH * VoH;
    float F_in = fresnelSchlick90(NoL, 1.0, F90);
    float F_out = fresnelSchlick90(NoV, 1.0, F90);
    return F_in * F_out;
}

vec3 brdfMicrofacets(vec3 L, vec3 V, vec3 N, float metallic, float roughness, vec3 baseColor, float reflectance) {
    vec3 H = normalize(V + L);
    
    float NoV = clamp(dot(N, V), 0.0, 1.0);
    float NoL = clamp(dot(N, L), 0.0, 1.0);
    float NoH = clamp(dot(N, H), 0.0, 1.0);
    float VoH = clamp(dot(V, H), 0.0, 1.0);
    
    vec3 f0 = vec3(0.16 * (reflectance * reflectance));
    f0 = mix(f0, baseColor, metallic);
    
    vec3 F = fresnelSchlick(VoH, f0);
    float D = D_GGX(NoH, roughness);
    float G = G_Smith(NoV, NoL, roughness);
    
    vec3 spec = (F * D * G) / (4.0 * max(NoV, 0.001) * max(NoL, 0.001));
    
    vec3 rhoD = baseColor;
    
    // optionally
    rhoD *= vec3(1.0) - F;
    rhoD *= disneyDiffuseFactor(NoV, NoL, VoH, roughness);
    
    rhoD *= (1.0 - metallic);
    
    vec3 diff = rhoD * RECIPROCAL_PI;

    return diff + spec;
}
