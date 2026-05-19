import { Injectable } from '@angular/core';

function readJSONFile(filename: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.overrideMimeType("application/json");
    xhr.open('GET', 'assets/' + filename, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      }
    };
    xhr.onerror = function () {
      reject(new Error(`Failed to load JSON file: ${filename}`));
    };
    xhr.send();
  });
}


@Injectable({
  providedIn: 'root',
})

export class AppConfigService {
  baseUrl = './v1/ecommerce/';
  isInitialized = false;

}


