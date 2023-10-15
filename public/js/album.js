const albumContainer = document.getElementById('album');
const images = ['./images/f_sc.jpeg']; // Add your image URLs here

// Loop through the images array and create thumbnail elements for each image
images.forEach(image => {
    const imgElement = document.createElement('img');
    imgElement.src = image;
    imgElement.classList.add('thumbnail'); // Apply CSS styling
    albumContainer.appendChild(imgElement);

    // Add event listener for each image to display it in a larger format when clicked
    imgElement.addEventListener('click', () => {
        displayImage(image);
    });
});

// Function to display the clicked image in a larger format
function displayImage(imageUrl) {
    // You can create a modal or a separate container to display the image in a larger format
    // Update the UI as needed to show the selected image
    console.log('Image displayed:', imageUrl);
}