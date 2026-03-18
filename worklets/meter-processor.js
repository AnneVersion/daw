/**
 * AudioWorklet processor voor real-time level metering.
 * Berekent RMS en peak levels per channel.
 * Post data naar main thread op ~30fps.
 */
class MeterProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._updateInterval = 1024 / sampleRate; // ~23ms bij 44100Hz
        this._nextUpdate = currentTime + this._updateInterval;
        this._peakL = 0;
        this._peakR = 0;
        this._rmsL = 0;
        this._rmsR = 0;
        this._sampleCount = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input.length) return true;

        const left = input[0];
        const right = input.length > 1 ? input[1] : left;

        let sumL = 0, sumR = 0;
        for (let i = 0; i < left.length; i++) {
            const sL = left[i], sR = right[i];
            sumL += sL * sL;
            sumR += sR * sR;
            if (Math.abs(sL) > this._peakL) this._peakL = Math.abs(sL);
            if (Math.abs(sR) > this._peakR) this._peakR = Math.abs(sR);
        }

        this._rmsL += sumL;
        this._rmsR += sumR;
        this._sampleCount += left.length;

        // Pass audio through
        const output = outputs[0];
        if (output) {
            for (let ch = 0; ch < output.length; ch++) {
                if (input[ch]) output[ch].set(input[ch]);
            }
        }

        if (currentTime >= this._nextUpdate) {
            const rmsL = Math.sqrt(this._rmsL / this._sampleCount);
            const rmsR = Math.sqrt(this._rmsR / this._sampleCount);

            this.port.postMessage({
                rmsL, rmsR,
                peakL: this._peakL,
                peakR: this._peakR
            });

            this._peakL = 0;
            this._peakR = 0;
            this._rmsL = 0;
            this._rmsR = 0;
            this._sampleCount = 0;
            this._nextUpdate = currentTime + this._updateInterval;
        }

        return true;
    }
}

registerProcessor('meter-processor', MeterProcessor);
