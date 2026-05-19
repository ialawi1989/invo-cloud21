import { EnvironmentPlugin } from 'webpack';
import { config } from 'dotenv';
config();
module.exports = {
  plugins: [
    new EnvironmentPlugin([
      'BASE_URL'

  ]),
    // new CompressionPlugin({
    //   test: /\.(js|css|html|svg|txt|eot|otf|ttf|gif|ts)$/,
    //   filename(info) {
    //     let opFile = info.filename.split('.'),
    //       opFileType = opFile.pop(),
    //       opFileName = opFile.join('.');
    //     return `${opFileName}.${opFileType}.gzip`;
    //   }
    // })




  ]
}
