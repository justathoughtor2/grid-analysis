vl.register(vega, vegaLite, {})

let initialData = [
  [true, true, true, true],
  [false, true, true, true],
  [false, true, true, false],
  [true, false, true, false]
]

const generateButtonGrid = function(width, height) {
  let grid = ''
  initialData = []

  for(let y = 0; y < height; y++) {
    grid += '<div class="row">'
    for(let x = 0; x < width; x++) {
      grid += `<button class="btn btn-secondary" id="${x + '-' + y}">Inactive</button>`
    }
    grid += '</div>'
  }

  for(let x = 0; x < width; x++) {
    initialData.push([])
    for(let y = 0; y < height; y++) {
      initialData[x].push(false)
    }
  }

  $('#button-grid').html(grid)
  generateData(initialData, parseInt($('#adjacency').val()))
}

$('#width').change(function() {
  generateButtonGrid(parseInt($('#width').val()), parseInt($('#height').val()))
})

$('#height').change(function() {
  generateButtonGrid(parseInt($('#width').val()), parseInt($('#height').val()))
})

$('#adjacency').change(function() {
  generateButtonGrid(parseInt($('#width').val()), parseInt($('#height').val()))
})

$('.btn').click(function() {
  xy = $(this).attr('id').split('-')
  x = parseInt(xy[0])
  y = parseInt(xy[1])

  initialData[x][y] = !initialData[x][y]
  if($(this).hasClass('btn-secondary')) {
    $(this).addClass('btn-primary').removeClass('btn-secondary').text('Active')
  }
  else {
    $(this).addClass('btn-secondary').removeClass('btn-primary').text('Inactive')
  }

  generateData(initialData, parseInt($('#adjacency').val()))
  generateChart()
})

const generateData = function(init, numAdjacent) {
  let data = []
  
  for(let x = 0; x < init.length; x++) {
    for(let y = 0; y < init[x].length; y++) {
      let datum = {'x': x, 'y': y, 'activeOrMatch': init[x][y] ? 'active' : 'inactive'}
      if(init[x][y]) {
        let score = 0
        
        x + 1 < init.length && init[x+1][y] ? score++ : score
        x - 1 >= 0 && init[x-1][y] ? score++ : score
        y + 1 < init[x].length && init[x][y+1] ? score++ : score
        y - 1 >= 0 && init[x][y-1] ? score++ : score
        
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

let generateChart = function() {
  chartSpec = vl.markPoint({'filled': true})
  .data(data)
  .encode(
    vl.color().fieldN('activeOrMatch').scale(scale).title('Active, Inactive or Match'),
    vl.size().value(300),
    vl.y().fieldO('x').sort('descending').title('x'),
    vl.x().fieldO('y').title('y')
  )
  .width(510)
  .height(340)
  .autosize({'type': 'fit-x', 'contains': 'padding'})
  .toJSON()

  vegaEmbed('#chart', chartSpec)
}

generateChart()
