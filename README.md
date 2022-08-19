# Rotsprite algorithm with JavaScript (Canvas vs WebGL)

Hello, this is a rough implementation of the Rotsprite algorithm [1] by Xenowhirl built by me with both HTML5 Canvas and WebGL.

## The algorithm is described by its creator this way

The algorithm is dead simple, so I'll just describe it and you can decide: First it scales the image to 8x size, using a "pixel guessing" algorithm to add detail. Then it scales the image to 1/8 size and also rotates it using standard aliased rotation and scaling. That's basically it. To get a big speed increase for a small penalty in quality, you could use 4x instead of 8x and skip some other optional steps I did, but I wanted high quality above all else.

Here's the more detailed version: First it scales the image to double size using something similar to Scale2x, but checking if pixels are more similar to each other instead of if they're equal, which makes the result less blocky and ultimately leads to smoother output. The important thing is that the scaling algorithm works by choosing a pixel instead of by blending pixels. It does that 3 times to achieve an 8x scale, determined empirically to be a good place to stop. Then (optional step) it tries to find the best rotation offsets by looping through a small grid of offsets between 0 and 7 pixels in x and y, and for each one looping through the 8x image at the rotation angle with step size 8 pixels, and adding the squared distance of the difference in color components between each point and its immediate (1 pixel) neighbors in the 8x image, which will be 0 except on the boundaries between 8x pixels. Then it simply performs standard nearest-neighbor scaling+rotation, starting at the offsets that gave minimal sum of squared differences, and using 1/8 scale to return the image to normal size while rotating it. Finally (optional step), it tries to fix any overlooked single-pixel details by checking for any pixels in the output image that have 3 or 4 identical neighbors equal to them and unequal to the color at the corresponding place in the source image, and replacing those pixels with the one from the source image.

You might say I'm cheating by not vectorizing the graphics into lines and curves and rotating those, but I say this method is an approximation of that and works better in practice. When the original image has little detail at the angle it's being sampled, aliased rotation makes too many arbitrary decisions, but the smoothing of a pixel-choosing enlargement algorithm is sufficient to resolve most of the ambiguity. [2]

## And described on Wikipedia this way

The algorithm first scales the image to 8 times its original size with a modified Scale2× algorithm which treats similar (rather than identical) pixels as matches. It then (optionally) calculates what rotation offset to use by favoring sampled points which are not boundary pixels. Next, the rotated image is created with a nearest-neighbor scaling and rotation algorithm that simultaneously shrinks the big image back to its original size and rotates the image. Finally, overlooked single-pixel details are (optionally) restored if the corresponding pixel in the source image is different and the destination pixel has three identical neighbors. [3]

## My implementation

What my implementation basically does is it scales up the image by 8x the size and then rotates it by X degree and then it scales it down back by 1/8. It's not exactly as explained by the creator as there were some ambiguity in the its description and less resources on the internet to rely on.

I have implemented the algorithm using plain JavaScript with HTML5 Canvas and with WebGL.

The results of both implementations are almost perfect and appreciated by the Pixel-art artists who used it, however performance of the HTML5 Canvas implementation is extremely slow especially with large pictures but the WebGL implement is very fast.

[1]: http://info.sonicretro.org/RotSprite
[2]: https://forums.sonicretro.org/index.php?threads/sprite-rotation-utility.8848/#post-159754
[3]: https://en.wikipedia.org/wiki/Pixel-art_scaling_algorithms#RotSprite
