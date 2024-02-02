/// <reference path="../libs/js/property-inspector.js" />
/// <reference path="../libs/js/utils.js" />

let localSettings = null;

$PI.onConnected((jsn) => {
    const form = document.querySelector('#property-inspector');
    const { actionInfo, appInfo, connection, messageType, port, uuid } = jsn;
    const { payload, context } = actionInfo;
    const { settings } = payload;
    localSettings = settings;

    Utils.setFormValue(settings, form);
    form.addEventListener(
        'input',
        Utils.debounce(150, () => {
            const value = Utils.getFormValue(form);
            $PI.setSettings(value);
            localSettings = value;
        })
    );
});
