import TelemetryReporter from "@vscode/extension-telemetry";

const randomStrings = '5600aa930b08_1568_5f24_009f_ba24bbde';
let reporter: TelemetryReporter;

export const activateReporter = () => {
    reporter = new TelemetryReporter(randomStrings.replace(/_/g, '-').split('').reverse().join(''));
    return reporter;
}

export const reportEvent: typeof reporter['sendTelemetryEvent'] = (args) => {
    if (!reporter) {
        console.error('Reporter not activated');
        return;
    }

    reporter.sendTelemetryEvent(args);
};