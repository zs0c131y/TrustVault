// Back Button Functionality
document.getElementById("backButton").addEventListener("click", () => {
    history.back(); // Navigates to the previous page
});

// Dropdown logic example
document.getElementById("logic-operator-1").addEventListener("change", (event) => {
    console.log(`Dropdown 1 selected value: ${event.target.value}`);
});

document.getElementById("logic-operator-2").addEventListener("change", (event) => {
    console.log(`Dropdown 2 selected value: ${event.target.value}`);
});

