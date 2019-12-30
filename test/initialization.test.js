describe('initialization', function() {
  let expect = chai.expect
  it('initializes initialData to default values', function(done) {
    expect(initialData).to.deep.equal([
      [true, true, true, true],
      [false, true, true, true],
      [false, true, true, false],
      [true, false, true, false]
    ])
    done()
  })

  it('sets the data array to a length of 16', function(done) {
    expect(data.length).to.equal(16)
    done()
  })
  
  it('initializes the match, active, or inactive values appropriately per element in data', function(done) {
    expect(data[1]).to.deep
      .equal({'x': 1, 'y': 0, 'activeOrMatch': 'match'})
    expect(data[0]).to.deep
      .equal({'x': 0, 'y': 0, 'activeOrMatch': 'active'})
    expect(data[4]).to.deep
      .equal({'x': 0, 'y': 1, 'activeOrMatch': 'inactive'})
    done()
  })
})
