#!/usr/bin/env python3
"""Collect real public-web souvenir image files for manual review.
Copyright and subject identity are NOT certified. Do not publish without review."""
from __future__ import annotations
import concurrent.futures as cf
import csv
import hashlib
import html
import io
import json
import os
import re
import threading
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse, quote
import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageOps, UnidentifiedImageError

BASE = Path(__file__).resolve().parent
DATA = json.loads((BASE / "souvenirs.json").read_text(encoding="utf-8"))
OUT = BASE / "collected"
OUT.mkdir(exist_ok=True)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.8",
}
COUNTRIES = dict(ee="Estonia",lv="Latvia",lt="Lithuania",pl="Poland",cz="Czech Republic",
 sk="Slovakia",hu="Hungary",si="Slovenia",hr="Croatia",ba="Bosnia and Herzegovina",
 rs="Serbia",me="Montenegro",xk="Kosovo",mk="North Macedonia",al="Albania",
 ro="Romania",bg="Bulgaria",md="Moldova",by="Belarus",ua="Ukraine")
# Previously located individual image candidates; downloaded only after image validation.
KNOWN = {
 "ee-01":"https://pood.orkla.ee/app/uploads/2024/01/4740012600381-product-image-craving-kalev-kamatahvel-100g-3000x3000px.png",
 "ee-06":"https://wineanthology.com/images/thumbs/0016761_vana-tallinn-estonian-liqueur_600.gif",
 "ee-11":"https://www.biggreensmile.com/shop/images/products/JOIKSCCANNIGHT_main.jpg?t=5580113846",
 "pl-08":"https://plikimpi.krakow.pl/pliki/575271/20.jpg",
 "sk-03":"https://digitalcontent.api.tesco.com/v2/media/ghs/0343171a-19dd-4467-913c-566903b20f43/32f35a2a-5120-42c5-ac85-f4c1343c9f21_605645403.jpeg",
 "hu-03":"https://i.ebayimg.com/images/g/qNoAAOSwm~Nl3gQZ/s-l400.jpg",
 "si-01":"https://www.soline.at/sites/default/files/imagecache/product_full/produktbilder/FleurDeSel-Kartondose.jpg",
 "mk-11":"https://balkan-market.com/cdn/shop/products/57145_0.png?v=1659035191&width=1946",
 "bg-01":"https://shop.himejibaraen.com/cdn/shop/products/fdefe07a3a891dfc253b1f4723aac4cb_530x%402x.webp?v=1682218223",
 "md-01":"https://gomagcdn.ro/domains/bucuria.ro/files/product/large/bomboane-moldova-1-250-gr-010629.webp",
 "by-01":"https://static.tildacdn.com/tild3264-3865-4531-a261-356462613264/1666147612_2-balthaz.jpg",
 "lt-01":"https://www.negaminsiu.lt/storage/27276/conversions/sakotis-27275-full.webp",
 "pl-02":"https://assets.icanet.se/image/upload/cs_srgb/t_product_large_2x_v1/mzqp0rym7wb6wukmbaf0.webp",
 "ee-02":"https://visitestonia.com/content-images/654507/time-traveling-in-tallinns-restaurants-en-001-visit-estonia.jpg",
}
LOCK=threading.Lock()
def get(url, timeout=20, params=None):
    with requests.Session() as s:
        return s.get(url, params=params, headers=HEADERS, timeout=timeout, allow_redirects=True)

def is_safe_url(u):
    if not isinstance(u,str) or not u.startswith(("http://","https://")): return False
    h = (urlparse(u).hostname or "").lower()
    if not h or h in ("localhost","0.0.0.0") or h.endswith((".local",".internal")): return False
    if re.match(r"^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)",h): return False
    return True

def bing_images(q):
    try:
        u="https://www.bing.com/images/search?"+urlencode({"q":q,"first":"1","form":"HDRSC2"})
        r=get(u,timeout=20)
        if r.status_code!=200:return []
        soup=BeautifulSoup(r.text,"html.parser")
        found=[]
        for a in soup.select("a.iusc"):
            try:
                obj=json.loads(a.get("m") or "{}")
                url=obj.get("murl")
                if is_safe_url(url):
                    found.append({"url":url,"page":obj.get("purl", ""),"caption":obj.get("t",""),"method":"bing"})
            except Exception:pass
        if not found:
            for m in re.findall(r'\\"murl\\"\s*:\s*\\"(.*?)\\"',r.text)[:15]:
                url=html.unescape(m.replace("\\/","/"))
                if is_safe_url(url):found.append({"url":url,"page":"","caption":"","method":"bing_regex"})
        return found[:12]
    except Exception:
        return []

def commons_images(q):
    try:
        params=dict(action="query",format="json",generator="search",gsrnamespace=6,
          gsrsearch=q,gsrlimit=8,prop="imageinfo",iiprop="url|size|extmetadata",iiurlwidth=1400)
        r=get("https://commons.wikimedia.org/w/api.php",params=params,timeout=20)
        if r.status_code!=200:return []
        pages=r.json().get("query",{}).get("pages",{})
        found=[]
        for v in pages.values():
            info=(v.get("imageinfo") or [{}])[0]
            title=v.get("title","")
            url=info.get("thumburl") or info.get("url")
            if is_safe_url(url):
                found.append({"url":url,"page":info.get("descriptionurl",""),"caption":title,"method":"commons",
                "license":(info.get("extmetadata") or {}).get("LicenseShortName",{}).get("value","")})
        return found
    except Exception:
        return []

def download_image(url):
    if not is_safe_url(url):return None
    try:
        r=get(url,timeout=25)
        if r.status_code!=200 or len(r.content)>16000000 or len(r.content)<3000:return None
        ctype=r.headers.get("Content-Type","").lower()
        if "image" not in ctype and not re.search(r"\.(png|jpe?g|gif|webp)(\?|$)",url,re.I):return None
        with Image.open(io.BytesIO(r.content)) as img:
            img.load()
            if img.width<230 or img.height<200:return None
            img=ImageOps.exif_transpose(img)
            if img.mode in ("RGBA","LA") or ("transparency" in img.info):
                bg=Image.new("RGB",img.size,"white")
                bg.paste(img,mask=img.convert("RGBA").getchannel("A"))
                img=bg
            else:
                img=img.convert("RGB")
            img.thumbnail((1400,1400),Image.Resampling.LANCZOS)
            buf=io.BytesIO();img.save(buf,"WEBP",quality=83,method=4)
            return buf.getvalue(),img.size
    except (requests.RequestException,OSError,UnidentifiedImageError,ValueError):
        return None

def work(row):
    code=row["countryCode"];title=row["titleEn"];ident=row["id"]
    country=COUNTRIES[code]
    query=f'{title} {country} souvenir product'
    candidates=[]
    if ident in KNOWN:
        candidates.append({"url":KNOWN[ident],"page":"","caption":title,"method":"known_candidate"})
    candidates.extend(bing_images(query))
    # Search original names and a simpler phrase if ordinary product name is too broad.
    if not candidates or len(candidates)<3:
        candidates.extend(bing_images(f'"{title}" {country}'))
    if not candidates:
        candidates.extend(commons_images(f'{title}'))
    tested=set()
    attempts=0
    for candidate in candidates:
        url=candidate["url"]
        if url in tested:continue
        tested.add(url);attempts+=1
        if attempts>12:break
        img=download_image(url)
        if img is None:continue
        data,dims=img
        folder=OUT/code;folder.mkdir(parents=True,exist_ok=True)
        path=folder/f"{ident}.webp"
        path.write_bytes(data)
        return dict(**row,imageFile=str(path.relative_to(OUT)),imageUrl=url,
          sourcePage=candidate.get("page",""),searchMethod=candidate.get("method",""),
          dimensions=f"{dims[0]}x{dims[1]}",bytes=len(data),downloadStatus="downloaded_unverified",
          copyrightStatus="not_checked",subjectMatchStatus="requires_manual_review",
          searchedQuery=query,attemptedUrls=attempts)
    return dict(**row,imageFile="",imageUrl="",sourcePage="",searchMethod="",
      dimensions="",bytes=0,downloadStatus="missing",copyrightStatus="not_checked",
      subjectMatchStatus="not_checked",searchedQuery=query,attemptedUrls=attempts)

def main():
    print(f"Starting collection for {len(DATA)} items",flush=True)
    results=[]
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        futs={pool.submit(work,row):row for row in DATA}
        for ix,fut in enumerate(cf.as_completed(futs),1):
            try:
                row=fut.result()
            except Exception as exc:
                v=futs[fut];row=dict(**v,imageFile="",imageUrl="",sourcePage="",searchMethod="",
                    dimensions="",bytes=0,downloadStatus="error",copyrightStatus="not_checked",
                    subjectMatchStatus="not_checked",searchedQuery="",attemptedUrls=0,error=str(exc))
            results.append(row)
            if ix%10==0:
                good=sum(x.get("downloadStatus")=="downloaded_unverified" for x in results)
                print(f"Finished {ix}/{len(DATA)} - photos {good}",flush=True)
    results.sort(key=lambda x:x["id"])
    (OUT/"manifest.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    cols=["id","countryCode","titleEn","imageFile","imageUrl","sourcePage","searchMethod",
          "dimensions","bytes","downloadStatus","copyrightStatus","subjectMatchStatus","searchedQuery","attemptedUrls"]
    with (OUT/"manifest.csv").open("w",encoding="utf-8-sig",newline="") as h:
        w=csv.DictWriter(h,fieldnames=cols,extrasaction="ignore");w.writeheader();w.writerows(results)
    report={}
    for code in COUNTRIES:
        rows=[x for x in results if x["countryCode"]==code]
        report[code]={"total":len(rows),"downloaded":sum(x["downloadStatus"]=="downloaded_unverified" for x in rows),
           "missing":[x["id"]+" "+x["titleEn"] for x in rows if x["downloadStatus"]!="downloaded_unverified"]}
    (OUT/"country_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    (OUT/"README_KO.txt").write_text(
      "CEE Side 기념품 실물 이미지 후보 수집 결과\n\n"
      "국가코드별 폴더에 WebP 이미지가 저장됩니다. 파일 이름은 상품 ID에 대응합니다.\n"
      "manifest.csv에서 상품명, 이미지 원본 URL 및 수집 상태를 확인하세요.\n"
      "중요: 자동 수집된 사진은 제품 일치 여부, 저작권 및 재사용 허가가 확인되지 않았습니다.\n"
      "자신의 웹사이트에 게시하기 전 원본 출처의 이용 조건과 상품 일치 여부를 검토해야 합니다.\n",
      encoding="utf-8")
    found=sum(x.get("downloadStatus")=="downloaded_unverified" for x in results)
    print(json.dumps({"total":len(results),"downloaded":found,"missing":len(results)-found}),flush=True)
if __name__=="__main__":main()
