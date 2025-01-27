import React from 'react';
import './App.css';

function App() {
  return (
    <div className="container">
      <h1 className="font-italic">Hey, this is Eric!</h1>
      <hr />
      <h3>About Me</h3>
      <p>I'm a sophomore at UCLA studying Computer Engineering, and a photography hobbyist!</p>
      <img
        className="headshot"
        src="./images/headshot.jpg"
        alt="Eric"
        width="250"
        height="250"
      />
      <div className="links">
        <a href="/Resume.pdf">
          <img className="linkImage" src="./images/icon_cv.png" alt="CV" width="50" height="50" />
        </a>
        <a href="https://www.linkedin.com/in/xinle-song/">
          <img className="linkImage" src="/images/icon_linkedin.png" alt="LinkedIn" width="50" height="50" />
        </a>
        <a href="https://github.com/EricSongXinLe/">
          <img className="linkImage" src="/images/icon_github.png" alt="GitHub" width="50" height="50" />
        </a>
        <a href="https://www.flickr.com/photos/196818188@N02/">
          <img className="linkImage" src="/images/icon_camera.png" alt="Flickr" width="50" height="50" />
        </a>
        <a href="mailto:erics311@ucla.edu">
          <img className="linkImage" src="/images/icon_email.png" alt="Email" width="50" height="50" />
        </a>
      </div>
      <hr />
    </div>
  );
}

export default App;