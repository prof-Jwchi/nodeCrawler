import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'fs';

class KopoAdmissionCrawler {
  constructor() {
    this.url = 'https://ipsi.kopo.ac.kr/poly/ipsi/ipsiRateSearch.do';
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('브라우저 초기화 중...');
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 200
    });
    this.page = await this.browser.newPage();
  }

  async crawlAdmissionData() {
    try {
      console.log('페이지 접속 중...');
      await this.page.goto(this.url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      await this.page.waitForTimeout(3000);

      console.log('Step 1: 모집과정 선택 ...');
      const step1Result = await this.page.evaluate(() => {
        const radio = document.querySelector('#check01_5');
        if (radio) {
          radio.checked = true;
          radio.click();
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          radio.dispatchEvent(new Event('click', { bubbles: true }));
          return { success: true, checked: radio.checked };
        }
        return { success: false };
      });
      console.log('  결과:', step1Result);
      await this.page.waitForTimeout(1000);

      console.log('Step 2: 전체 캠퍼스 체크박스 클릭...');
      const step2Result = await this.page.evaluate(() => {
        const checkbox = document.querySelector('#check02');
        if (checkbox) {
          checkbox.checked = true;
          checkbox.click();
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          checkbox.dispatchEvent(new Event('click', { bubbles: true }));
          
          // onclick 함수 직접 호출
          if (typeof allChk2 === 'function') {
            allChk2(checkbox);
          }
          
          return { success: true, checked: checkbox.checked };
        }
        return { success: false };
      });
      console.log('  결과:', step2Result);
      await this.page.waitForTimeout(1000);

    //   console.log('Step 3: 특정 캠퍼스 선택 (0000002)...');
    //   const step3Result = await this.page.evaluate(() => {
    //     const checkbox = document.querySelector('#check02_02');
    //     if (checkbox) {
    //       checkbox.checked = true;
    //       checkbox.click();
    //       checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    //       checkbox.dispatchEvent(new Event('click', { bubbles: true }));
          
    //       // onclick 함수 직접 호출
    //       if (typeof campusGb === 'function') {
    //         campusGb(checkbox);
    //       }
          
    //       return { success: true, checked: checkbox.checked };
    //     }
    //     return { success: false };
    //   });
    //   console.log('  결과:', step3Result);
    //   await this.page.waitForTimeout(1000);

      console.log('Step 4: 특정 대학 선택 (1280000)...');
      const step4Result = await this.page.evaluate(() => {
        const checkbox = document.querySelector('#check02_0000002_10');
        if (checkbox) {
          checkbox.checked = true;
          checkbox.click();
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          checkbox.dispatchEvent(new Event('click', { bubbles: true }));
          
          // onclick 함수 직접 호출
          if (typeof parentChk2 === 'function') {
            parentChk2(checkbox, '0000002');
          }
          
          return { success: true, checked: checkbox.checked };
        }
        return { success: false };
      });
      console.log('  결과:', step4Result);
      await this.page.waitForTimeout(1000);

      console.log('Step 5: 검색 버튼 클릭...');
      const step5Result = await this.page.evaluate(() => {
        // 여러 방법으로 검색 버튼 찾기
        const selectors = [
          'input[type="button"][onclick*="search"]',
          'input[type="button"][onclick*="Search"]',
          'button[onclick*="search"]',
          'input[type="submit"]',
          'input[value*="검색"]',
          'button:contains("검색")',
          '#searchBtn',
          '.btn_search',
          'btn_gray btn_search'
        ];
        
        for (const selector of selectors) {
          const btn = document.querySelector(selector);
          if (btn) {
            btn.click();
            return { success: true, selector: selector };
          }
        }
        
        // onclick 속성이 있는 모든 요소 검색
        const allClickable = document.querySelectorAll('[onclick]');
        for (const el of allClickable) {
          const onclick = el.getAttribute('onclick') || '';
          if (onclick.toLowerCase().includes('search')) {
            el.click();
            return { success: true, selector: 'onclick 속성', onclick: onclick };
          }
        }
        
        return { success: false };
      });
      console.log('  결과:', step5Result);
      await this.page.waitForTimeout(5000);

      console.log('Step 6: 데이터 추출 중...');
      
      // 스크린샷 저장
      await this.page.screenshot({ path: 'result_page.png', fullPage: true });
      console.log('  스크린샷 저장: result_page.png');
      
      const data = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        const results = [];

        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 7) {
            const rowData = {
              모집과정: cells[0]?.textContent.trim() || '',
              대학: cells[1]?.textContent.trim() || '',
              학과: cells[2]?.textContent.trim() || '',
              모집구분: cells[3]?.textContent.trim() || '',
              모집정원: cells[4]?.textContent.trim() || '',
              접수인원: cells[5]?.textContent.trim() || '',
              경쟁률: cells[6]?.textContent.trim() || ''
            };
            
            if (rowData.학과 || rowData.대학) {
              results.push(rowData);
            }
          }
        });

        return results;
      });

      console.log(`\n총 ${data.length}개의 데이터 수집 완료`);
      
      if (data.length > 0) {
        console.log('\n=== 데이터 미리보기 (처음 5개) ===');
        data.slice(0, 5).forEach((item, idx) => {
          console.log(`${idx + 1}. ${item.대학} / ${item.학과} / 경쟁률: ${item.경쟁률}`);
        });
      }

      return data;

    } catch (error) {
      console.error('크롤링 오류:', error.message);
      
      try {
        await this.page.screenshot({ path: 'error_page.png', fullPage: true });
        console.log('오류 스크린샷 저장: error_page.png');
      } catch (e) {}
      
      throw error;
    }
  }

  async saveToJSON(data, filename = 'admission_data.json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = `${filename.replace('.json', '')}_${timestamp}.json`;
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✓ JSON 저장: ${filepath}`);
    return filepath;
  }

  async saveToExcel(data, filename = 'admission_data.xlsx') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filepath = `${filename.replace('.xlsx', '')}_${timestamp}.xlsx`;
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '경쟁률');
    
    XLSX.writeFile(workbook, filepath);
    console.log(`✓ Excel 저장: ${filepath}`);
    return filepath;
  }

  async saveToCSV(data, filename = 'admission_data.csv') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filepath = `${filename.replace('.csv', '')}_${timestamp}.csv`;
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    fs.writeFileSync(filepath, '\ufeff' + csv, 'utf-8');
    console.log(`✓ CSV 저장: ${filepath}`);
    return filepath;
  }

  async close() {
    if (this.browser) {
      console.log('\n5초 후 브라우저 종료...');
      await this.page.waitForTimeout(5000);
      await this.browser.close();
      console.log('브라우저 종료 완료');
    }
  }

  async run(options = {}) {
    const { format = 'all', filename = 'kopo_admission' } = options;
    
    try {
      await this.initialize();
      const data = await this.crawlAdmissionData();

      if (data.length === 0) {
        console.log('\n⚠️ 수집된 데이터가 없습니다.');
        console.log('result_page.png 파일을 확인하여 페이지 상태를 확인하세요.');
        return;
      }

      const savedFiles = [];
      
      if (format === 'json' || format === 'all') {
        savedFiles.push(await this.saveToJSON(data, filename));
      }
      
      if (format === 'excel' || format === 'all') {
        savedFiles.push(await this.saveToExcel(data, filename));
      }
      
      if (format === 'csv' || format === 'all') {
        savedFiles.push(await this.saveToCSV(data, filename));
      }

      console.log('\n🎉 크롤링 완료!');
      console.log(`📊 총 ${data.length}건 수집`);
      console.log('📁 저장된 파일:');
      savedFiles.forEach(file => console.log(`   ${file}`));

      return data;

    } catch (error) {
      console.error('\n❌ 크롤러 실행 오류:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// 실행
(async () => {
  const crawler = new KopoAdmissionCrawler();
  
  await crawler.run({
    format: 'all',
    filename: 'kopo_admission'
  });
})();

export default KopoAdmissionCrawler;