"use client";
import React from "react";
import Webcam from "react-webcam";
import { useCallback, useState } from "react";
import { api } from "~/trpc/react";

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "user"
};

const WebcamCapture = ({ setImageSrc, setSteps }: { setImageSrc: Function, setSteps: Function }) => {
  const submitMutation = api.submitImage.useMutation();
  const webcamRef = React.useRef<Webcam>(null);
  const capture = useCallback(async () => {
    const imageSrc: string = webcamRef.current?.getScreenshot() || "";
    if (imageSrc) {
      setImageSrc(imageSrc);
      const res = await submitMutation.mutateAsync({ imageb64: imageSrc });
      setSteps(res.steps);
    }
  }, [webcamRef]);

  return (
    <>
      <Webcam
        audio={false}
        height={720}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        width={1280}
        videoConstraints={videoConstraints}
      />
      <button onClick={capture}>Capture photo</button>
    </>
  );
};
  
export default WebcamCapture;