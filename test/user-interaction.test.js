describe('user interaction', function() {
  let expect = chai.expect
  let height = 4
  let width = 4
  let numAdjacent = 1
  
  it('sets initialData[0][1] to true when clicked', function(done) {
    setTimeout(function() {
      $('#height').val(height).change()
      $('#width').val(width).change()
      $('#adjacency').val(numAdjacent).change()
      $(`#${0}-${0}`).click()
      $(`#${0}-${1}`).click()
      expect(initialData[0][1]).to.equal(true)
      done()
    }, 1000)
  })
  it('reinitializes data with a length of height * width', function(done) {
    expect(data.length).to.equal(height * width)
    done()
  })
  it('sets data[1] to a match with an (x,y) coordinate pair of (1,0) when numAdjacent == 1, width == 4 and height == 4', function(done) {
    expect(data[1]).to.deep
      .equal({'x': 1, 'y': 0, 'activeOrMatch': 'match'})
    done()
  })
})
