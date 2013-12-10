module.exports = {
    squareCenterCrop: function(size) {
        return this.resize(size, size, "^").
            gravity("Center").
            extent(size, size);
    }
};