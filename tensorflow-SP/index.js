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
  const data = await loadData()
  const { averages, closingPrices } = computeSMA(data, 50)
  
  const values = averages.map((avg, i) => ({
    y: avg,
    x: closingPrices[i]
  }))

  tfvis.render.scatterplot(
    { name: 'S&P' },
    { values },
    {
      xLabel: 'Historical Closing Prices',
      yLabel: 'Average',
      height: 300,
    }
  )
}

document.addEventListener('DOMContentLoaded', run)