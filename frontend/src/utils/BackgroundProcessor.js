import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

export class BackgroundProcessor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.selfieSegmentation = new SelfieSegmentation({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });

        this.selfieSegmentation.setOptions({
            modelSelection: 1
        });

        this.selfieSegmentation.onResults(this.onResults.bind(this));

        this.currentEffect = 'none';
        this.backgroundImage = null;
        this.inputVideo = null;
        this.isProcessing = false;
        this.isSending = false; // Guard against overlapping send() calls
        this.fps = 24;
        this.lastFrameTime = 0;
        this.outputStream = this.canvas.captureStream(this.fps);
    }


    setEffect(type, imageUrl = null) {
        this.currentEffect = type;
        if (imageUrl) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = imageUrl;
            img.onload = () => {
                this.backgroundImage = img;
                console.log('Background image loaded:', imageUrl);
            };
            img.onerror = (e) => {
                console.error('Failed to load background image:', imageUrl, e);
            };
        } else {
            this.backgroundImage = null;
        }
    }

    async start(videoElement) {
        if (this.isProcessing) return;
        this.inputVideo = videoElement;
        this.isProcessing = true;
        this.renderLoop();
    }

    stop() {
        this.isProcessing = false;
        this.inputVideo = null;
    }

    async renderLoop() {
        if (!this.isProcessing || !this.inputVideo) return;

        const now = Date.now();
        const elapsed = now - this.lastFrameTime;
        const frameInterval = 1000 / this.fps;

        if (elapsed >= frameInterval) {
            this.lastFrameTime = now;

            // Re-sync canvas size to input video resolution
            if (this.inputVideo.videoWidth > 0 &&
                (this.canvas.width !== this.inputVideo.videoWidth || this.canvas.height !== this.inputVideo.videoHeight)) {
                this.canvas.width = this.inputVideo.videoWidth;
                this.canvas.height = this.inputVideo.videoHeight;
                console.log(`Resized canvas to ${this.canvas.width}x${this.canvas.height}`);
            }

            if (this.currentEffect === 'none' || this.inputVideo.readyState < 2) {
                this.ctx.drawImage(this.inputVideo, 0, 0, this.canvas.width, this.canvas.height);
            } else if (!this.isSending) {
                this.isSending = true;
                try {
                    await this.selfieSegmentation.send({ image: this.inputVideo });
                } catch (err) {
                    console.error('Error in SelfieSegmentation.send:', err);
                } finally {
                    this.isSending = false;
                }
            }
        }

        // Use setTimeout instead of requestAnimationFrame for background tab persistence
        this.renderTimeout = setTimeout(() => this.renderLoop(), Math.max(1, frameInterval - (Date.now() - now)));
    }



    onResults(results) {
        const { width, height } = this.canvas;

        this.ctx.save();
        this.ctx.clearRect(0, 0, width, height);

        // Standard mask processing for both blur and image
        if (this.currentEffect === 'blur' || (this.currentEffect === 'image' && this.backgroundImage)) {
            // Step 1: Draw the person where the mask is (source-in)
            this.ctx.drawImage(results.segmentationMask, 0, 0, width, height);
            this.ctx.globalCompositeOperation = 'source-in';
            this.ctx.drawImage(results.image, 0, 0, width, height);

            // Step 2: Draw the background behind the person (destination-over)
            this.ctx.globalCompositeOperation = 'destination-over';

            if (this.currentEffect === 'blur') {
                this.ctx.filter = 'blur(10px)';
                this.ctx.drawImage(results.image, 0, 0, width, height);
                this.ctx.filter = 'none';
            } else if (this.currentEffect === 'image' && this.backgroundImage) {
                this.ctx.drawImage(this.backgroundImage, 0, 0, width, height);
            }
        } else {
            // Fallback: draw original frame
            this.ctx.drawImage(results.image, 0, 0, width, height);
        }

        this.ctx.restore();
    }

    getStream() {
        return this.outputStream;
    }
}
