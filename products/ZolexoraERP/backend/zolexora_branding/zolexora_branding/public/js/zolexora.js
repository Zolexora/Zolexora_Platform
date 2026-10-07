frappe.ready(function() {
    function setBrandTitle() {
        document.title = "Zolexora ERP";
    }

    setBrandTitle();
    window.addEventListener("hashchange", setBrandTitle);
    window.addEventListener("popstate", setBrandTitle);
});
