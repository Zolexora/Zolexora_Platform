frappe.ready(function() {
    function applyTheme() {
        var theme = frappe.boot.user && frappe.boot.user.defaults && frappe.boot.user.defaults.theme;
        if (theme === 'Dark') {
            document.body.setAttribute('data-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
        }
    }

    applyTheme();
});
