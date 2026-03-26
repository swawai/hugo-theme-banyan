(function () {
    var button = document.querySelector('[data-me-return]');
    if (!button) {
        return;
    }

    var homeLink = document.querySelector('[data-me-home]');
    var fallbackHref = homeLink && homeLink.href ? homeLink.href : '/';

    button.addEventListener('click', function () {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }

        if (document.referrer) {
            try {
                var current = new URL(window.location.href);
                var previous = new URL(document.referrer, current.href);

                if (previous.origin === current.origin) {
                    window.location.href = previous.href;
                    return;
                }
            } catch (error) {
            }
        }

        window.location.href = fallbackHref;
    });
}());
