const URL = "model/";

let model, webcam, labelContainer, maxPredictions;

async function init() {
  const modelURL = URL + "model.json";
  const metadataURL = URL + "metadata.json";

  model = await tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();

  webcam = new tmImage.Webcam(300, 300, true);
  await webcam.setup(); // pedir permiso de cámara
  await webcam.play();

  document.getElementById("webcam-container").appendChild(webcam.canvas);

  labelContainer = document.getElementById("label-container");
  labelContainer.innerHTML = "";

  for (let i = 0; i < maxPredictions; i++) {
    labelContainer.appendChild(document.createElement("div"));
  }

  window.requestAnimationFrame(loop);
}

async function loop() {
  webcam.update();
  await predict();
  window.requestAnimationFrame(loop);
}

async function predict() {
  const prediction = await model.predict(webcam.canvas);

  for (let i = 0; i < maxPredictions; i++) {
    const className = prediction[i].className;
    const probability = (prediction[i].probability * 100).toFixed(2);

    labelContainer.childNodes[i].innerHTML =
      `${className}: ${probability}%`;
  }
}
