/**
 * AudioWorklet processor voor smooth gain ramping.
 * Voorkomt clicks bij volume changes door lineaire interpolatie.
 */
class GainProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{
            name: 'gain',
            defaultValue: 1.0,
            minValue: 0.0,
            maxValue: 2.0,
            automationRate: 'a-rate'
        }];
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        if (!input || !input.length) return true;

        const gainValues = parameters.gain;
        const isConstant = gainValues.length === 1;

        for (let ch = 0; ch < output.length; ch++) {
            const inp = input[ch] || input[0];
            const out = output[ch];
            for (let i = 0; i < out.length; i++) {
                out[i] = inp[i] * (isConstant ? gainValues[0] : gainValues[i]);
            }
        }

        return true;
    }
}

registerProcessor('gain-processor', GainProcessor);
