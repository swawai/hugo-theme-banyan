(function () {
    var reloadLink = document.querySelector('[data-page-action="reload"]');

    if (!reloadLink) {
        return;
    }

    reloadLink.addEventListener('click', function (event) {
        event.preventDefault();
        window.location.reload();
    });
}());
