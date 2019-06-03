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

  const values = data.map(d => ({
    x: new Date(d.Date),
    y: parseFloat(d.Close),
  }))
  
  tfvis.render.linechart(
    { name: 'S&P' },
    { values },
    {
      xLabel: 'Timestamp',
      yLabel: 'Closing Prices',
      height: 500,
      width: 1000,
    }
  )

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
}

document.addEventListener('DOMContentLoaded', run)