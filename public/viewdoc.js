document.querySelectorAll('.filter-button').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('.filter-button').forEach(btn => {
            btn.classList.remove('active');
        });
        this.classList.add('active');
        alert('Filtering by: ' + this.textContent);
    });
});



// Upload button
document.querySelector('.upload-button').addEventListener('click', function() {
    window.location="./requestdocv.html";
});

// Document actions
document.querySelectorAll('.action-button').forEach(button => {
    button.addEventListener('click', function() {
        alert('Action: ' + this.textContent);
    });
});

// Blockchain info copy
document.querySelectorAll('.blockchain-info').forEach(info => {
    info.addEventListener('click', function() {
        navigator.clipboard.writeText(this.textContent);
        alert('Copied to clipboard!');
    });
});

function goBack() {
    window.location="./profile.html";
}