let canvas = document.getElementById('webgl-canvas');

let vshader = `
	attribute vec4 position;
	attribute vec2 texCoord;

	uniform mediump int isUpscale; // acts like a boolean
	uniform vec2 resolution;
	uniform vec2 translation;
	uniform mat4 scale;
	uniform mat4 rotation;

	varying vec2 v_resolution;
	varying vec2 v_texCoord;
	void main() {
		if (isUpscale == 0) {
			// Rotate, translate and downscale
			vec2 zeroToOne = vec2(rotation * position) / resolution;
			vec2 zeroToTwo = zeroToOne * 2.0;
			vec2 clipSpace = zeroToTwo - 1.0;
			vec4 rotatedPos = vec4(clipSpace + 1.0, 1.0, 1.0);
			gl_Position = (scale * vec4(clipSpace + translation, 1.0, 1.0));
		} else {
			gl_Position = position;
		};
		v_resolution = resolution;
  		v_texCoord = texCoord;
	}
`
let fshader = `
    precision mediump float;

    uniform sampler2D sampler0;
    uniform sampler2D sampler1;
	uniform int isUpscale;

    varying vec2 v_texCoord;
    varying vec2 v_resolution;
    
    void main() {
	    vec4 P = texture2D(sampler0, v_texCoord);
    	if (isUpscale > 0) {
    		// EPX Scale
	    	vec4 A; vec4 B; vec4 C; vec4 D;
	    	vec4 color = P;
	    	float pixw = 1.0 / v_resolution.x;
	    	float pixh = 1.0 / v_resolution.y;

	    	if (gl_FragCoord.y > 1.0) {
	    		vec2 newTexCoord = vec2(v_texCoord.x, v_texCoord.y - (2.0*pixh));
	    		A = texture2D(sampler1, newTexCoord);
	    	} else {
				A = P;
	    	};
	    	if (gl_FragCoord.x < (v_resolution.x-2.0)) {
	    		vec2 newTexCoord = vec2(v_texCoord.x + (2.0*pixw), v_texCoord.y);
	    		B = texture2D(sampler1, newTexCoord);
	    	} else {
				B = P;
	    	};
	    	if (gl_FragCoord.x > 1.0) {
	    		vec2 newTexCoord = vec2(v_texCoord.x - (2.0*pixw), v_texCoord.y);
	    		C = texture2D(sampler1, newTexCoord);
	    	} else {
				C = P;
	    	};
	    	if (gl_FragCoord.y < (v_resolution.y-2.0)) {
	    		vec2 newTexCoord = vec2(v_texCoord.x, v_texCoord.y + (2.0*pixh));
	    		D = texture2D(sampler1, newTexCoord);
	    	} else {
				D = P;
	    	};

			// Shift gl_FragCoord by 0.5 pixel
			vec4 FragCoordShifted = gl_FragCoord - vec4(0.5, 0.5, 0.0, 0.0);

			// Override color value
	    	if (mod(FragCoordShifted.x, 2.0) == 0.0 && mod(FragCoordShifted.y, 2.0) == 0.0) {
	    		if ((C == A) && (C != D) && (A != B)) {
	    			color = A;
	    		};
	    		
	    	} else if (mod(FragCoordShifted.x, 2.0) != 0.0 && mod(FragCoordShifted.y, 2.0) == 0.0) {
	    		if ((A == B) && (A != C) && (B != D)) {
	    			color = B;
	    		};
	    	} else if (mod(FragCoordShifted.x, 2.0) == 0.0 && mod(FragCoordShifted.y, 2.0) != 0.0) {
	    		if ((D == C) && (D != B) && (C != A)) {
	    			color = C;
	    		};
	    	} else if (mod(FragCoordShifted.x, 2.0) != 0.0 && mod(FragCoordShifted.y, 2.0) != 0.0) {
	    		if ((B == D) && (B != A) && (D != C)) {
	    			color = D;
	    		};
	    	};

			gl_FragColor = color;
    	} else {
    		gl_FragColor = P;
    	}
    }
`
window.onload = function() {
	let input = document.getElementById("image-file");
    input.addEventListener('change', rotsprite, false);
}

function rotsprite(e) {
	let url = URL.createObjectURL(e.target.files[0]);
	let filename = e.target.files[0].name;

    let image = new Image();
    image.onload = function(){
		let t0 = performance.now();
		let imageData = image;
		let verticesTexCoords = new Float32Array([
		  -1, 1,  0.0, 1.0,
		  -1, -1, 0.0, 0.0,
		  1,  1,  1.0, 1.0,
		  1,  -1, 1.0, 0.0,
		]);
		const n = 4;
		const FSIZE = verticesTexCoords.BYTES_PER_ELEMENT;

		let gl = canvas.getContext('webgl', {antialias: false});
		let program = compile(gl, vshader, fshader);

		// Locations
		let resolution = gl.getUniformLocation(program, 'resolution')
		let translation = gl.getUniformLocation(program, 'translation')
		let scale = gl.getUniformLocation(program, 'scale')
		let rotation = gl.getUniformLocation(program, 'rotation');
		let isUpscale = gl.getUniformLocation(program, 'isUpscale');
		let position = gl.getAttribLocation(program, 'position');
		let texCoord = gl.getAttribLocation(program, 'texCoord');
		
		// Lookup the sampler locations.
		let sampler0 = gl.getUniformLocation(program, 'sampler0');
		let sampler1 = gl.getUniformLocation(program, 'sampler1');

		// Array of textures
		let textures = [gl.createTexture(), gl.createTexture()];

		// Set which texture units to render with.
		gl.uniform1i(sampler0, 0);
		gl.uniform1i(sampler1, 1);

		// Create the buffer object
		let vertexTexCoordBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexTexCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, verticesTexCoords, gl.STATIC_DRAW);

		// Use every 1st and 2nd float for position
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, FSIZE * 4, 0);
		gl.enableVertexAttribArray(position);

		// Use every 3rd and 4th float for texCoord
		gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, FSIZE * 4, FSIZE * 2);
		gl.enableVertexAttribArray(texCoord);

		// Enable EPX Scale
		gl.uniform1i(isUpscale, 1);

		// Scale
		const SCALE = 3;
		const natW = this.naturalWidth;
		const natH = this.naturalHeight;
		let currW;
		let currH;

		// Use 2 textures
		for (let i = 1; i <= SCALE; i++) {
			currW = natW*(2**i);
			currH = natH*(2**i);

			canvas.width = currW;
			canvas.height = currH;

			gl.viewport(0, 0, currW, currH);

			gl.uniform2f(resolution, currW, currH)

			// Flip the image's y axis
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

			textures.forEach((texture) => {
				// Enable texture
				gl.bindTexture(gl.TEXTURE_2D, texture);
				// Uploading the image
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

				// Stretch/wrap options
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			});

			// Set each texture unit to use a particular texture.
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, textures[0]);

			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, textures[1]);
			
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, n);

			// Save current images to imageData
			let pixels = new Uint8Array(currH*currW*4);
			gl.readPixels(0, 0, currW, currH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			imageData = new ImageData(new Uint8ClampedArray(pixels), currW, currH);
		}

		let verticesTexCoordsInPixels = new Float32Array([
		  -currW/2, currH/2,  0.0, 1.0,
		  -currW/2, -currH/2, 0.0, 0.0,
		  currW/2,  currH/2,  1.0, 1.0,
		  currW/2,  -currH/2, 1.0, 0.0,
		]);

		// buffer object
		let vertexTexCoordBuffer2 = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexTexCoordBuffer2);
		gl.bufferData(gl.ARRAY_BUFFER, verticesTexCoordsInPixels, gl.STATIC_DRAW);

		// Updating position attribute
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, FSIZE * 4, 0);
		gl.enableVertexAttribArray(position);

		// Enable texture 0
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

		// Stretch/wrap options
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		// Time to rotate
		gl.uniform1i(isUpscale, 0)
		
		const angleInput = document.getElementById('angle').value;
		const angle = Number(angleInput);
		const cosB = Math.cos(angle * Math.PI / 180);
		const sinB = Math.sin(angle * Math.PI / 180);

		const rotCornerX = Math.round(currW/2 * cosB + currH/2 * sinB);
	    const rotCornerY = Math.round(currH/2 * cosB - currW/2 * sinB);

	    const rotCorner2X = Math.round(-currW/2 * cosB + currH/2 * sinB);
	    const rotCorner2Y = Math.round(currH/2 * cosB - (-currW/2) * sinB);

	    const maxPosX = Math.max(Math.abs(rotCornerX), Math.abs(rotCorner2X));
	    const maxPosY = Math.max(Math.abs(rotCornerY), Math.abs(rotCorner2Y));

	    const rotW = maxPosX*2;
	    const rotH = maxPosY*2;

		// Rotate matrix
		let r_matrix = new Float32Array([
			cosB,  -sinB, 0.0, 0.0,
			sinB, cosB, 0.0, 0.0,
			0.0,   0.0,  1.0, 0.0,
			0.0,   0.0,  0.0, 1.0
			]);
		gl.uniformMatrix4fv(rotation, false, r_matrix);

		// Translation vector
		const translateX = (currW/2 - rotW/2/8 - natW/2)/(natW/2);
		const translateY = (currH/2 - rotH/2/8 - natH/2)/(natH/2);
		gl.uniform2f(translation, -translateX, -translateY);
		
		// Scale matrix
		const S = .125;
		const s_matrix = new Float32Array([
		  S,   0.0, 0.0, 0.0,
		  0.0, S,   0.0, 0.0,
		  0.0, 0.0, S,   0.0,
		  0.0, 0.0, 0.0, 1.0
		]);
		gl.uniformMatrix4fv(scale, false, s_matrix);

		canvas.width = Math.round(rotW/8);
		canvas.height = Math.round(rotH/8);

		// gl.clearColor(0, 0, 0, 0.0);
		// gl.clear(gl.COLOR_BUFFER_BIT);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, n);
		
		document.getElementById('timespan').textContent = Math.floor(performance.now() - t0);

		// export image data
		globalDataURL = canvas.toDataURL();
		globalFileName = e.target.files[0].name;
		
	};
	image.src = url;
}

function compile(gl, vshader, fshader) {
	let vs = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vs, vshader);
	gl.compileShader(vs);

	let fs = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fs, fshader);
	gl.compileShader(fs);

	let program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	gl.useProgram(program);

	console.log('vertex shader: ', gl.getShaderInfoLog(vs) || 'OK')
	console.log('fragment shader: ', gl.getShaderInfoLog(fs) || 'OK')
	console.log('program: ', gl.getProgramInfoLog(program) || 'OK')

	return program;
}

function downloadImage(dataURL, filename) {
	let link = document.createElement("a");
	link.download = `webgl-rot-${filename}`;
	link.href = dataURL;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	delete link;
}

document.getElementById('download').addEventListener('click', () => {
	downloadImage(globalDataURL, globalFileName);
})