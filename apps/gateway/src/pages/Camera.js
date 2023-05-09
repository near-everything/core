import React, { useRef } from 'react';
import Webcam from 'react-webcam';

const WebcamComponent = () => {
  const webcamRef = useRef(null);

  const capture = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    localStorage.setItem('capturedImage', imageSrc);
  };

  return (
    <div className="webcam-container">
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        className="webcam"
      />
      <button onClick={capture} className="capture-button">
        Capture
      </button>
    </div>
  );
};

export default WebcamComponent;