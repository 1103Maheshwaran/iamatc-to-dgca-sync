const originalAlert = window.alert;
window.alert = function(msg) {
    if (typeof msg === 'string' && msg.includes("Invalid Date Format. Please select Date from Calendar.")) {
        window.postMessage({ type: "DGCA_DATE_ERROR" }, "*");
        return; // Suppress the alert
    }
    if (originalAlert) originalAlert(msg);
};

window.addEventListener('ForceSetDate', function(e) {
    if (e.detail && e.detail.id && e.detail.value) {
        let el = document.getElementById(e.detail.id);
        if (el) {
            el.value = e.detail.value;
            if (typeof window.$ !== 'undefined') {
                try {
                    window.$(el).val(e.detail.value).trigger('change');
                } catch(err) {}
                try {
                    window.$(el).datepicker('update', e.detail.value);
                } catch(err) {}
            }
        }
    }
});
