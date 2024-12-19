function goBack() {
    window.location="./profile.html";
}

// Add click handlers for document actions
document.querySelectorAll('.action-button').forEach(button => {
    button.addEventListener('click', function() {
        alert('Action: ' + this.textContent);
    });
});

// Add click handlers for blockchain info copy
document.querySelectorAll('.blockchain-info').forEach(info => {
    info.addEventListener('click', function() {
        navigator.clipboard.writeText(this.textContent);
        alert('Copied to clipboard!');
    });
});
