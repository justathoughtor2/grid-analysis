vl.register(vega, vegaLite, {})

let initialData = [
  [true, true, true, true],
  [false, true, true, true],
  [false, true, true, false],
  [true, false, true, false]
]

const generateData = function(init, numAdjacent) {
  let data = []
  
  for(let y = 0; y < init.length; y++) {
    for(let x = init[y].length - 1; x >= 0; x--) {
      let datum = {'x': x, 'y': y, 'activeOrMatch': init[y][x] ? 'active' : 'inactive'}
      if(init[y][x]) {
        let score = 0
        
        y + 1 < init.length && init[y+1][x] ? score++ : score
        y - 1 >= 0 && init[y-1][x] ? score++ : score
        x + 1 < init[y].length && init[y][x+1] ? score++ : score
        x - 1 >= 0 && init[y][x-1] ? score++ : score
        
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

const generateButtonGrid = function(width, height) {
  let grid = '<div class="container">'
  initialData = []

  for(let y = 0; y < height; y++) {
    grid += '<div class="row">'
    initialData.push([])
    for(let x = width - 1; x >= 0; x--) {
      grid += `<button class="btn btn-secondary" id="${y + '-' + x}">Inactive</button>`
      initialData[y].push(false)
    }
    grid += '</div>'
  }

  grid += '</div>'

  $('#button-grid').html(grid)
  $('.btn').on('click', function() {
    yx = $(this).attr('id').split('-')
    x = parseInt(yx[1])
    y = parseInt(yx[0])
  
    initialData[y][x] = !initialData[y][x]
    if($(this).hasClass('btn-secondary')) {
      $(this).addClass('btn-primary').removeClass('btn-secondary').text('Active')
    }
    else {
      $(this).addClass('btn-secondary').removeClass('btn-primary').text('Inactive')
    }
  
    data = generateData(initialData, parseInt($('#adjacency').val()))
    generateChart()
  })
  data = generateData(initialData, parseInt($('#adjacency').val()))
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

const scale = {
  domain: ['inactive', 'active', 'match'],
  range: ['#6c757d', '#007bff', 'orange']
}

let generateChart = function() {
  chartSpec = vl.markPoint({'filled': true})
  .data(data)
  .encode(
    vl.color().fieldN('activeOrMatch').scale(scale).title('Active, Inactive or Match'),
    vl.size().value(300),
    vl.y().fieldO('y'),
    vl.x().fieldO('x').sort('descending')
  )
  .width(510)
  .height(340)
  .autosize({'type': 'fit-x'})
  .toJSON()

  vegaEmbed('#chart', chartSpec)
}

generateChart()
