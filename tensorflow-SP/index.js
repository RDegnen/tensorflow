const loadData = async () => {
  const req = await fetch('http://localhost:3000/data')
  const data = await req.json()
  return data
}

const chunk = (data, size) => {
  const chunkedArr = []
  let copied = [...data]
  const numOfChild = Math.ceil(copied.length / size)
  for (let i = 0; i < numOfChild; i++) {
    chunkedArr.push(copied.splice(0, size))
  }
  return chunkedArr
}

const computeSMA = (data, windowSize) => {
  const chunks = chunk(data, windowSize)
  const averages = []
  const closingPrices = []

  chunks.forEach(chunk => {
    let date
    const average = chunk.reduce((acc, current) => {
      const close = parseFloat(current.Close)
      closingPrices.push(close)
      date = current.Date
      return acc + close
    }, 0) / windowSize
    averages.push({ average, date })
  })
  
  return {
    averages,
    closingPrices: chunk(closingPrices, windowSize),
  }
}

const run = async () => {
  const data = await loadData()
  const { averages, closingPrices } = computeSMA(data, 14)

  const avgValues = averages.map((avg, i) => ({
    y: avg.average,
    x: new Date(avg.date)
  }))

  // const values = data.map(d => ({
  //   x: new Date(d.Date),
  //   y: parseFloat(d.Close),
  // }))
  
  // tfvis.render.linechart(
  //   { name: 'S&P' },
  //   { values },
  //   {
  //     xLabel: 'Timestamp',
  //     yLabel: 'Closing Prices',
  //     height: 500,
  //     width: 1000,
  //   }
  // )

  tfvis.render.linechart(
    { name: 'S&P 14 week SMA' },
    { values: avgValues },
    {
      xLabel: 'Timestamp',
      yLabel: 'Closing Averages',
      height: 500,
      width: 1000,
    }
  )

  const model = createModel()
  tfvis.show.modelSummary({ name: 'Model Summary' }, model)

  const tensorData = convertToTensor(averages)
  const { inputs, labels } = tensorData
  
  await trainModel(model, inputs, labels)

  testModel(model, averages, tensorData)
}

const createModel =() => {
  const model = tf.sequential()

  model.add(tf.layers.dense({ inputShape: [1], units: 20, useBias: true }))
  model.add(tf.layers.dense({ units: 30, activation: 'sigmoid' }))
  model.add(tf.layers.dense({ units: 40, activation: 'sigmoid' }))
  model.add(tf.layers.dense({ units: 40, activation: 'sigmoid' }))
  model.add(tf.layers.dense({ units: 50, activation: 'sigmoid' }))
  model.add(tf.layers.dense({ units: 1, useBias: true }))

  return model
}

const convertToTensor = data => 
  tf.tidy(() => {
    tf.util.shuffle(data)

    const inputs = data.map(d => new Date(d.date))
    const labels = data.map(d => d.average)

    const inputTensor = tf.tensor2d(inputs, [inputs.length, 1])
    const labelTensor = tf.tensor2d(labels, [labels.length, 1])

    const inputMax = inputTensor.max()
    const inputMin = inputTensor.min()
    const labelMax = labelTensor.max()
    const labelMin = labelTensor.min()

    const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin))
    const normalizedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin))

    return {
      inputs: normalizedInputs,
      labels: normalizedLabels,
      
      inputMax,
      inputMin,
      labelMax,
      labelMin,
    }
  })

const trainModel = async (model, inputs, labels) => {
  model.compile({
    optimizer: tf.train.adam(),
    loss: tf.losses.meanSquaredError,
    metrics: ['mse'],
  })

  const batchSize = 32
  const epochs = 100

  return await model.fit(inputs, labels, {
    batchSize,
    epochs,
    shuffle: true,
    callbacks: tfvis.show.fitCallbacks(
      { name: 'Training Performance' },
      ['loss', 'mse'],
      { height: 200, callbacks: ['onEpochEnd'] },
    )
  })
}

function testModel(model, inputData, normalizationData) {
  const { inputMax, inputMin, labelMin, labelMax } = normalizationData

  const [xs, preds] = tf.tidy(() => {
    const xs = tf.linspace(0, 1, 90)
    const preds = model.predict(xs.reshape([90, 1]))

    const unNormXs = xs
      .mul(inputMax.sub(inputMin))
      .add(inputMin)

    const unNormPreds = preds
      .mul(labelMax.sub(labelMin))
      .add(labelMin)

    return [unNormXs.dataSync(), unNormPreds.dataSync()]
  })

  const predictedPoints = Array.from(xs).map((val, i) => {
    return {x: val, y: preds[i]}
  })
  
  const originalPoints = inputData.map(d => ({
    x: new Date(d.date), y: d.average,
  }))

  tfvis.render.linechart(
    { name: 'Model Predictions vs Original Data' }, 
    { values: [originalPoints, predictedPoints], series: ['original', 'predicted'] }, 
    {
      xLabel: 'Timestamp',
      yLabel: 'Average',
      height: 500,
      width: 1000,
    }
  )
}

document.addEventListener('DOMContentLoaded', run)