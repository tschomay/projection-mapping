/*{
	"DESCRIPTION": "Rings",
	"CREDIT": "Surface Mapper tests",
	"ISFVSN": "2",
	"CATEGORIES": ["Generator"],
	"INPUTS": [
		{ "NAME": "speed", "TYPE": "float", "DEFAULT": 0.5, "MIN": 0.0, "MAX": 2.0 },
		{ "NAME": "solid", "TYPE": "color", "DEFAULT": [0.2, 0.8, 0.4, 1.0] },
		{ "NAME": "showSolid", "TYPE": "bool", "DEFAULT": true },
		{ "NAME": "count", "TYPE": "long", "DEFAULT": 3, "VALUES": [1, 3, 5], "LABELS": ["one", "three", "five"] },
		{ "NAME": "center", "TYPE": "point2D", "DEFAULT": [0.5, 0.5] },
	]
}*/

// A test generator written the way public ISF files are: desktop-only code behind #ifndef GL_ES, a macro,
// a constant, helpers (one named like an app helper), a reserved word as a variable name, and ISF's built-ins.

#define TAU 6.28318530718
const float pi = 3.14159265359;

#ifndef GL_ES
float distance (vec2 a, vec2 b) { return length(a - b); }
#endif

float noise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

float ring(vec2 p, float r) {
	float sample = abs(length(p - center) - r);
	return smoothstep(0.02, 0.0, sample);
}

void main() {
	vec2 uv = isf_FragNormCoord.xy;
	vec2 px = gl_FragCoord.xy / RENDERSIZE;
	float v = 0.0;
	for (int i = 0; i < 5; i++) {
		if (i >= count) break;
		v += ring(uv, fract(TIME * speed + float(i) / float(count)) * 0.5);
	}
	v += 0.1 * noise(px * TAU) * (pi - 3.0);
	gl_FragColor = showSolid ? vec4(solid.rgb * (uv.x > 0.5 ? 1.0 : 0.5), solid.a) : vec4(vec3(v), 1.0);
}
