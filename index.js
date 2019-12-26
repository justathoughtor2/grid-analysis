vl.register(vega, vegaLite, {})

let initialData = [
  [true, true, true, true],
  [false, true, true, true],
  [false, true, true, false],
  [true, false, true, false]
]

const generateData = function(init, numAdjacent) {
  let data = []
  
  for(let x = 0; x < init.length; x++) {
    for(let y = 0; y < init[x].length; y++) {
      let datum = {'x': x, 'y': y, 'activeOrMatch': init[x][y] ? 'active' : 'inactive'}
      if(init[x][y]) {
        let score = 0
        
        x + 1 < init.length && init[x+1][y] ? score++ : score
        x - 1 > 0 && init[x-1][y] ? score++ : score
        y + 1 < init[x].length && init[x][y+1] ? score++ : score
        y - 1 > 0 && init[x][y-1] ? score++ : score
        
        console.log(score)
        
        if(score == numAdjacent) {
          datum.activeOrMatch = 'match'
        }
      }
      
      data.push(datum)
    }
  }
  
  return data
}

let data = generateData(initialData, 3)

const scale = {
  domain: ['inactive', 'active', 'match'],
  range: ['gray', 'blue', 'orange']
}

vl.markPoint({'filled': true})
  .data(data)
  .encode(
    vl.color().fieldN('activeOrMatch').scale(scale).title('Active, Inactive or Match'),
    vl.size().value(300),
    vl.x().fieldO('x'),
    vl.y().fieldO('y').sort('descending')
  )
  .width(600)
  .height(400)
  .autosize({'type': 'fit-x', 'contains': 'padding'})
  .render()
  .then(chart => {
    document
      .getElementById("chart")
      .appendChild(chart)
  })