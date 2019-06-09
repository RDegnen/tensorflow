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
    const average = chunk.reduce((acc, current) => {
      const close = parseFloat(current.Close)
      closingPrices.push(close)
      return acc + close
    }, 0) / windowSize
    averages.push(average)
  })
  
  return {
    averages,
    closingPrices: chunk(closingPrices, windowSize),
  }
}

const run = async () => {
  const windowSize = 14
  const data = await loadData()
  const { averages, closingPrices } = computeSMA(data, windowSize)
  const trainingLength = arr => arr.length * .7
  let day = 0
  let testDayStart = null

  const values = averages.map((d,i) => {
    const val = {
      x: day,
      y: d,
    }
    day += windowSize
    if (i === trainingLength(averages) - 1) {
      testDayStart = day
    }
    return val
  })

  tfvis.render.linechart(
    { name: 'S&P 14 week SMA' },
    { values },
    {
      xLabel: 'Day',
      yLabel: 'Closing Averages',
      height: 500,
      width: 1000,
    }
  )

  const model = createModel()
  tfvis.show.modelSummary({ name: 'Model Summary' }, model)
  
  const mappedAverages = averages.map((val, i) => ({
    value: val,
    closingPrices: closingPrices[i]
  }))

  const trainingData = mappedAverages.slice(0, trainingLength(mappedAverages))
  const tesingData = mappedAverages.slice(trainingLength(mappedAverages))

  const trainingTensors = convertToTensor(trainingData, windowSize)
  const testingTensors = convertToTensor(tesingData, windowSize)

  await trainModel(model, trainingTensors.xs, trainingTensors.ys)

  testModel(model, values, testingTensors, windowSize, testingTensors.xs, testDayStart)
}

const createModel =() => {
  const model = tf.sequential()
  // Closing prices should be in the input and an expected average for that perioud should be the output
  model.add(tf.layers.dense({ inputShape: [14], units: 20, useBias: true }))
  model.add(tf.layers.dense({ units: 30, activation: 'sigmoid' }))
  model.add(tf.layers.dense({ units: 40, activation: 'sigmoid' }))
  model.add(tf.layers.dense({ units: 1, useBias: true }))

  return model
}

const convertToTensor = (data, windowSize) => 
  tf.tidy(() => {
    tf.util.shuffle(data)

    const xs = data
      .map(d => d.closingPrices)
      .filter(cps => cps.length === windowSize)
    
    const ys = data
      .filter(d => d.closingPrices.length === windowSize)
      .map(d => d.value)
    
    const xsTensor = tf.tensor2d(xs, [xs.length, xs[0].length])
    const ysTensor = tf.tensor2d(ys, [ys.length, 1])
    
    const xsMax = xsTensor.max()
    const xsMin = xsTensor.min()
    const ysMax = ysTensor.max()
    const ysMin = ysTensor.min()

    const normalizedXS = xsTensor.sub(xsMin).div(xsMax.sub(xsMin))
    const normalizedYS = ysTensor.sub(ysMin).div(ysMax.sub(ysMin))

    return {
      xs: normalizedXS,
      ys: normalizedYS,
      
      xsMax,
      xsMin,
      ysMax,
      ysMin,
    }
  })

const trainModel = async (model, inputs, outputs) => {
  model.compile({
    optimizer: tf.train.adam(0.05),
    loss: tf.losses.meanSquaredError,
  })

  const batchSize = 32
  const epochs = 25

  return await model.fit(inputs, outputs, {
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

function generateInputs() {
  const inputs = []
  for (let i = 0; i < 269; i++) {
    const inputsArr = []
    for (let i = 0; i < 14; i++) {
      inputsArr.push(Math.random())
    }
    inputs.push(inputsArr)
  }
  return inputs
}

function testModel(model, originalData, normalizationData, windowSize, testXS, day) {
  const { ysMin, ysMax } = normalizationData

  const preds = tf.tidy(() => {    
    const preds = model.predict(testXS)

    const unNormPreds = preds
      .mul(ysMax.sub(ysMin))
      .add(ysMin)

    return unNormPreds.dataSync()
  })
  
  const predictedPoints = Array.from(preds).map(val => {
    const returnValue = {
      x: day, 
      y: val
    }
    day += windowSize
    return returnValue
  })

  tfvis.render.linechart(
    { name: 'Model Predictions vs Original Data' }, 
    { values: [originalData, predictedPoints], series: ['original', 'predicted'] }, 
    {
      xLabel: 'Day',
      yLabel: 'Average',
      height: 500,
      width: 1000,
    }
  )
}

document.addEventListener('DOMContentLoaded', run)