function handleCardClick(service) {
    //console.log(`Selected service: ${service}`);
    // Add navigation or modal display logic here
    switch(service) {
        case 'land-registry':
            window.location.href="landregservice.html";
            break;
        case 'document-verification':
            window.location.href="documentverservice.html";
            break;
    }
}

// Get current time to personalize greeting
function updateGreeting() {
    const hour = new Date().getHours();
    const greeting = document.querySelector('h1');
    let timeOfDay = 'Good Morning';
   
    if (hour >= 12 && hour < 17) {
        timeOfDay = 'Good Afternoon';
    } else if (hour >= 17) {
        timeOfDay = 'Good Evening';
    }
   
    greeting.textContent = `${timeOfDay}, User`;
}


updateGreeting();

