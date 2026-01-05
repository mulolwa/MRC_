
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  User, 
  Download, 
  Plus, 
  Trash2,
  Users,
  Building,
  Upload,
  LocateFixed,
  Map as MapIcon,
  Search,
  X,
  Image as ImageIcon,
  Truck,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Zap,
  Briefcase
} from 'lucide-react';
import { 
  STATION_COORDS, 
  DISTRICTS, 
  ROLES, 
  BANK_DETAILS, 
  DEFAULT_MRC_LOGO, 
  DEFAULT_COA_LOGO,
  RATE_GROUPS 
} from './constants';
import { 
  haversine, 
  parseKML, 
  fetchImageAsBase64 
} from './services/geospatial';
import { 
  FormData, 
  CalcMetrics, 
  Totals, 
  KmlSite, 
  PersonnelRow 
} from './types';

// Global type augmentation for CDNs
declare global {
  interface Window {
    L: any;
    jspdf: any;
    html2canvas: any;
  }
}

const App: React.FC = () => {
  // --- States ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    attention: '',
    workDescription: '',
    personnel: [{ id: crypto.randomUUID(), role: 'Mine Surveyor', numOfficers: 1, numDays: 1, dsaRate: 1050 }],
    station: 'Lusaka',
    manualDistrict: '',
    customDistrictCoords: null,
    kmlFiles: [],
    mrcLogo: null,
    coaLogo: null,
    fuelPrice: 0,
    numVehicles: 1,
    preparedBy: '',
    preparedTitle: '',
    managerSurvey: '',
    checkedTitle: 'Manager Survey'
  });

  const [calcMetrics, setCalcMetrics] = useState<CalcMetrics>({
    stationToSiteDist: 0,
    nearestDistrict: null,
    distToNearestDistrict: 0,
    workingRadius: 0,
    totalDistance: 0,
    furthestSiteName: ''
  });

  const [totals, setTotals] = useState<Totals>({
    dsaTotal: 0,
    fuelTotal: 0,
    cumulativeTotal: 0,
    contingency: 0,
    grandTotal: 0
  });

  // --- Refs for Maps ---
  const mapRef = useRef<HTMLDivElement>(null);
  const previewMapRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<any>(null);
  const leafletPreviewInstance = useRef<any>(null);

  // --- Helpers ---
  const getDsaRate = (roleLabel: string, districtName: string) => {
    let division = 1;
    if (roleLabel === 'Assistant Mine Surveyor') division = 2;
    if (roleLabel === 'Driver') division = 3;
    
    const name = String(districtName).trim();
    const isGroupA = RATE_GROUPS.groupA.some(g => g.toLowerCase() === name.toLowerCase());
    const isGroupB = RATE_GROUPS.groupB.some(g => g.toLowerCase() === name.toLowerCase());
    
    if (division === 1) return isGroupA ? 1250 : (isGroupB ? 1150 : 1050);
    if (division === 2) return isGroupA ? 1100 : (isGroupB ? 1000 : 950);
    if (division === 3) return isGroupA ? 900 : (isGroupB ? 800 : 770);
    return 0;
  };

  const formatCurrency = (amount: number) => 
    `ZMW ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- Map Update Logic ---
  const updateMaps = useCallback(() => {
    if (!window.L) return;
    const L = window.L;
    const station = STATION_COORDS[formData.station];

    const initMapInstance = (container: HTMLDivElement | null, instanceRef: React.MutableRefObject<any>) => {
      if (!container) return null;
      if (instanceRef.current) {
        instanceRef.current.off();
        instanceRef.current.remove();
        instanceRef.current = null;
      }
      try {
        const map = L.map(container, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false }).setView([station.lat, station.lng], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            crossOrigin: true,
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);
        instanceRef.current = map;
        return map;
      } catch (err) {
        console.error("Map initialization failed", err);
        return null;
      }
    };

    const drawContent = (map: any, isPreview: boolean) => {
      if (!map) return;
      
      // Base Station Marker
      L.circleMarker([station.lat, station.lng], { 
        radius: 7, 
        fillColor: "#065f46", 
        color: "#fff", 
        weight: 2, 
        fillOpacity: 1 
      }).addTo(map).bindPopup(`Base: ${formData.station}`);

      if (formData.kmlFiles.length > 0) {
        formData.kmlFiles.forEach(site => {
          if (site.rawPoints && site.rawPoints.length > 2) {
            L.polygon(site.rawPoints.map(p => [p.lat, p.lng]), { 
              color: '#ea580c', 
              fillOpacity: 0.15, 
              weight: 2 
            }).addTo(map);
          }
          L.circleMarker([site.lat, site.lng], { 
            radius: 5, 
            fillColor: "#ea580c", 
            color: "#fff", 
            weight: 1, 
            fillOpacity: 1 
          }).addTo(map).bindPopup(site.name);
        });

        const currentNearestName = formData.manualDistrict || calcMetrics.nearestDistrict;
        const currentNearestCoord = formData.customDistrictCoords || DISTRICTS.find(d => d.name === currentNearestName);

        if (currentNearestCoord) {
          const nearestMarker = L.marker([currentNearestCoord.lat, currentNearestCoord.lng], {
            draggable: !isPreview,
            icon: L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color:#065f46; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 8px rgba(0,0,0,0.4);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })
          }).addTo(map).bindPopup("Nearest District Point");

          if (!isPreview) {
            nearestMarker.on('dragend', (event: any) => {
              const pos = event.target.getLatLng();
              setFormData(prev => ({ ...prev, customDistrictCoords: { lat: pos.lat, lng: pos.lng } }));
            });
            formData.kmlFiles.forEach(site => {
               L.polyline([[station.lat, station.lng], [site.lat, site.lng]], { 
                 color: '#64748b', 
                 dashArray: '8, 8', 
                 weight: 1.5,
                 opacity: 0.6
               }).addTo(map);
            });
          }
        }

        let siteBounds = L.latLngBounds(formData.kmlFiles.map(s => [s.lat, s.lng]));
        formData.kmlFiles.forEach(site => {
          if (site.rawPoints) site.rawPoints.forEach(p => siteBounds.extend([p.lat, p.lng]));
        });

        if (isPreview) {
          map.fitBounds(siteBounds, { padding: [20, 20], animate: false });
        } else {
          const fullBounds = siteBounds.extend([station.lat, station.lng]);
          if (currentNearestCoord) fullBounds.extend([currentNearestCoord.lat, currentNearestCoord.lng]);
          map.fitBounds(fullBounds, { padding: [50, 50], animate: false });
        }
      }
      setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    };

    if (mapRef.current) drawContent(initMapInstance(mapRef.current, leafletMapInstance), false);
    if (previewMapRef.current) drawContent(initMapInstance(previewMapRef.current, leafletPreviewInstance), true);
  }, [formData.station, formData.kmlFiles, formData.manualDistrict, formData.customDistrictCoords, calcMetrics.nearestDistrict]);

  // --- Side Effects ---
  useEffect(() => {
    const station = STATION_COORDS[formData.station];
    if (formData.kmlFiles.length === 0) {
      setCalcMetrics({
        stationToSiteDist: 0,
        nearestDistrict: null,
        distToNearestDistrict: 0,
        workingRadius: 0,
        totalDistance: 0,
        furthestSiteName: ''
      });
      return;
    }

    let furthestSite = formData.kmlFiles[0];
    let maxStationDist = haversine(station.lat, station.lng, furthestSite.lat, furthestSite.lng);
    
    formData.kmlFiles.forEach(site => {
      const d = haversine(station.lat, station.lng, site.lat, site.lng);
      if (d > maxStationDist) {
        maxStationDist = d;
        furthestSite = site;
      }
    });

    let nearest: any;
    let minD: number;

    if (formData.customDistrictCoords) {
      nearest = { name: "Custom Selection" };
      minD = haversine(furthestSite.lat, furthestSite.lng, formData.customDistrictCoords.lat, formData.customDistrictCoords.lng);
      const dsaRef = DISTRICTS.reduce((prev, curr) => {
        const d = haversine(formData.customDistrictCoords!.lat, formData.customDistrictCoords!.lng, curr.lat, curr.lng);
        return (d < prev.dist) ? { dist: d, name: curr.name } : prev;
      }, { dist: Infinity, name: "Other" });
      nearest.name = dsaRef.dist < 5 ? dsaRef.name : "Other Areas";
    } else if (formData.manualDistrict) {
      const match = DISTRICTS.find(d => d.name.toLowerCase() === formData.manualDistrict.toLowerCase());
      nearest = match || { name: formData.manualDistrict };
      minD = match ? haversine(furthestSite.lat, furthestSite.lng, match.lat, match.lng) : 0;
    } else {
      nearest = DISTRICTS[0];
      minD = haversine(furthestSite.lat, furthestSite.lng, DISTRICTS[0].lat, DISTRICTS[0].lng);
      DISTRICTS.forEach(d => {
        const dist = haversine(furthestSite.lat, furthestSite.lng, d.lat, d.lng);
        if (dist < minD) {
          minD = dist;
          nearest = d;
        }
      });
    }

    const maxDays = Math.max(...formData.personnel.map(p => p.numDays), 1);
    const wr = minD * 2 * maxDays;
    const totalDist = maxStationDist + wr;
    
    setCalcMetrics({ 
      stationToSiteDist: maxStationDist, 
      nearestDistrict: nearest.name, 
      distToNearestDistrict: minD, 
      workingRadius: wr, 
      totalDistance: totalDist, 
      furthestSiteName: furthestSite.name 
    });
  }, [formData.station, formData.kmlFiles, formData.manualDistrict, formData.customDistrictCoords, formData.personnel]);

  useEffect(() => {
    const district = calcMetrics.nearestDistrict || "Lusaka";
    setFormData(prev => ({
      ...prev,
      personnel: prev.personnel.map(p => ({
        ...p,
        dsaRate: getDsaRate(p.role, district)
      }))
    }));
  }, [calcMetrics.nearestDistrict]);

  useEffect(() => {
    const dsaTotal = formData.personnel.reduce((sum, p) => sum + (p.numOfficers * p.numDays * p.dsaRate), 0);
    const fuelTotal = ((calcMetrics.totalDistance * formData.fuelPrice * 1.15 * 2) / 6.5) * formData.numVehicles;
    const cumulativeTotal = dsaTotal + fuelTotal;
    const contingency = cumulativeTotal * 0.10;
    setTotals({ 
      dsaTotal, 
      fuelTotal, 
      cumulativeTotal, 
      contingency, 
      grandTotal: cumulativeTotal + contingency 
    });
  }, [formData.personnel, formData.fuelPrice, formData.numVehicles, calcMetrics.totalDistance]);

  useEffect(() => {
    updateMaps();
  }, [updateMaps]);

  // --- Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = event.target?.result;
        if (typeof res === 'string') {
          const data = parseKML(res);
          if (data) {
            setFormData(prev => ({ 
              ...prev, 
              kmlFiles: [...prev.kmlFiles, { 
                id: crypto.randomUUID(), 
                name: file.name, 
                ...data 
              }],
              customDistrictCoords: null 
            }));
          }
        }
      };
      reader.readAsText(file);
    });
  };

  const removeKmlFile = (id: string) => {
    setFormData(prev => ({ ...prev, kmlFiles: prev.kmlFiles.filter(f => f.id !== id) }));
  };

  const handleTopLevelChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const isNumber = ['fuelPrice', 'numVehicles'].includes(name);
      const updated = { ...prev, [name]: isNumber ? (parseFloat(value) || 0) : value };
      if (name === 'station' || name === 'manualDistrict') updated.customDistrictCoords = null;
      return updated;
    });
  };

  const handlePersonnelChange = (id: string, field: keyof PersonnelRow, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      personnel: prev.personnel.map(p => {
        if (p.id === id) {
          const updated = { ...p, [field]: value } as PersonnelRow;
          if (field === 'role') {
            updated.dsaRate = getDsaRate(value as string, formData.manualDistrict || calcMetrics.nearestDistrict || "Other");
          }
          return updated;
        }
        return p;
      })
    }));
  };

  const addPersonnel = () => {
    const defaultRole = 'Mine Surveyor';
    setFormData(prev => ({
      ...prev,
      personnel: [...prev.personnel, { 
        id: crypto.randomUUID(),
        role: defaultRole, 
        numOfficers: 1, 
        numDays: 1, 
        dsaRate: getDsaRate(defaultRole, formData.manualDistrict || calcMetrics.nearestDistrict || "Other") 
      }]
    }));
  };

  const removePersonnel = (id: string) => {
    if (formData.personnel.length > 1) {
      setFormData(prev => ({ ...prev, personnel: prev.personnel.filter(p => p.id !== id) }));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'mrcLogo' | 'coaLogo') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setFormData(prev => ({ ...prev, [type]: event.target?.result as string }));
    reader.readAsDataURL(file);
  };

  // --- Export Logic ---
  const generatePDF = async () => {
    if (!window.jspdf || !window.html2canvas) return;
    setIsGenerating(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - 40;
      
      let currentY = 15;
      const mrcBase64 = await fetchImageAsBase64(formData.mrcLogo || DEFAULT_MRC_LOGO);
      const coaBase64 = await fetchImageAsBase64(formData.coaLogo || DEFAULT_COA_LOGO);

      if (mrcBase64) doc.addImage(mrcBase64, 'JPEG', 15, currentY, 25, 25);
      if (coaBase64) doc.addImage(coaBase64, 'JPEG', pageWidth - 40, currentY, 25, 25);
      
      doc.setFontSize(18); doc.setTextColor(6, 95, 70); doc.setFont(undefined, 'bold');
      doc.text("Minerals Regulation Commission", pageWidth / 2, currentY + 14, { align: 'center' });
      currentY += 38;
      
      doc.setFontSize(11); doc.setTextColor(60, 60, 60);
      doc.text("Dept. of Mining and Non-Mining Rights", pageWidth / 2, currentY, { align: 'center' });
      doc.setFontSize(10); doc.text("-Survey Section-", pageWidth / 2, currentY + 6, { align: 'center' });
      
      currentY += 20;
      doc.setFontSize(15); doc.setTextColor(234, 88, 12); doc.setFont(undefined, 'bold');
      doc.text("OFFICIAL SERVICE INVOICE", pageWidth / 2, currentY, { align: 'center' });
      doc.setFontSize(9); doc.text(`Ref: MRC/SRV/${new Date().getFullYear()}/${Math.floor(Math.random()*1000)}`, margin, currentY + 10);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, currentY + 10, { align: 'right' });
      currentY += 25;
      
      doc.setFontSize(11); doc.setTextColor(40, 40, 40); doc.setFont(undefined, 'bold');
      doc.text("To:", 20, currentY); doc.setFont(undefined, 'normal'); doc.text(String(formData.attention || "N/A"), 30, currentY);
      
      currentY += 10;
      doc.setFont(undefined, 'bold'); doc.text("Subject:", 20, currentY); doc.setFont(undefined, 'normal');
      const splitDesc = doc.splitTextToSize(String(formData.workDescription || "No description provided."), contentWidth);
      doc.text(splitDesc, 40, currentY);
      currentY += 10 + (splitDesc.length * 5);

      if (previewMapRef.current) {
        const canvas = await window.html2canvas(previewMapRef.current, { useCORS: true, scale: 2 });
        const mapImg = canvas.toDataURL("image/jpeg", 0.85);
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, currentY, contentWidth, 80);
        doc.addImage(mapImg, 'JPEG', margin + 1, currentY + 1, contentWidth - 2, 78);
        currentY += 85;
      }

      doc.addPage();
      currentY = 20;
      doc.setFillColor(245, 252, 250); doc.rect(margin, currentY, contentWidth, 10, 'F');
      doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(6, 95, 70);
      doc.text("Particulars", 25, currentY + 7); doc.text("Amount (ZMW)", pageWidth - 25, currentY + 7, { align: 'right' });
      currentY += 15;

      doc.setFont(undefined, 'normal'); doc.setTextColor(40, 40, 40);
      formData.personnel.forEach(p => {
        doc.text(`${p.role} (qty:${p.numOfficers} x days:${p.numDays})`, 25, currentY);
        doc.text((p.numOfficers * p.numDays * p.dsaRate).toFixed(2), pageWidth - 25, currentY, { align: 'right' });
        currentY += 8;
      });

      doc.text(`Logistics & Fuel (${calcMetrics.totalDistance.toFixed(1)}km, ${formData.numVehicles} Unit/s)`, 25, currentY);
      doc.text(totals.fuelTotal.toFixed(2), pageWidth - 25, currentY, { align: 'right' });
      currentY += 12;

      doc.setDrawColor(220, 220, 220); doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 8;
      doc.setFont(undefined, 'bold'); doc.text("Sub-total", 25, currentY);
      doc.text(totals.cumulativeTotal.toFixed(2), pageWidth - 25, currentY, { align: 'right' });
      currentY += 7;
      doc.setFont(undefined, 'normal'); doc.text("10% Contingency", 25, currentY);
      doc.text(totals.contingency.toFixed(2), pageWidth - 25, currentY, { align: 'right' });
      currentY += 12;
      
      doc.setFillColor(6, 95, 70); doc.setTextColor(255, 255, 255);
      doc.rect(margin, currentY, contentWidth, 12, 'F'); doc.setFontSize(12); doc.setFont(undefined, 'bold');
      doc.text("TOTAL DUE (ZMW)", 25, currentY + 8);
      doc.text(totals.grandTotal.toFixed(2), pageWidth - 25, currentY + 8, { align: 'right' });
      
      currentY += 30;
      doc.setFillColor(248, 250, 252); doc.rect(margin, currentY, contentWidth, 30, 'F');
      doc.setTextColor(6, 95, 70); doc.setFontSize(9); doc.setFont(undefined, 'bold');
      doc.text(`SETTLEMENT TO: ${BANK_DETAILS.accountName}`, 25, currentY + 7);
      doc.setTextColor(60, 60, 60); doc.setFontSize(8); doc.setFont(undefined, 'normal');
      doc.text(`BANK: ${BANK_DETAILS.bankName} | BRANCH: ${BANK_DETAILS.branch}`, 25, currentY + 14);
      doc.text(`ACC: ${BANK_DETAILS.accountNumber} | SWIFT: ${BANK_DETAILS.swiftCode}`, 25, currentY + 21);
      
      currentY += 50;
      doc.line(margin, currentY, 80, currentY); doc.line(pageWidth - 80, currentY, pageWidth - margin, currentY);
      doc.setFontSize(10); doc.setFont(undefined, 'bold');
      doc.text(formData.preparedBy || "Prepared By", 20, currentY + 6);
      doc.text(formData.managerSurvey || "Authorized By", pageWidth - 80, currentY + 6);
      
      doc.save(`Invoice_${formData.attention.replace(/\s+/g, '_') || 'MRC'}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF generation failed. Check console.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateJPG = async () => {
    if (!window.html2canvas || !invoiceRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await window.html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `MRC_Invoice_Preview.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (e) {
      alert("JPG export failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Top Banner */}
      <nav className="sticky top-0 z-50 bg-emerald-900 text-white border-b-4 border-emerald-700 shadow-lg px-6 py-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg shadow-inner">
            <img src={formData.mrcLogo || DEFAULT_MRC_LOGO} className="w-10 h-10 object-contain" alt="MRC" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none uppercase">Minerals Regulation Commission</h1>
            <p className="text-[10px] text-emerald-400 font-bold tracking-[0.2em] mt-1">Geospatial Intelligence & Logistics</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={generateJPG} 
            disabled={isGenerating}
            className="hidden md:flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm border border-emerald-600"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
            <span>Export JPG</span>
          </button>
          <button 
            onClick={generatePDF} 
            disabled={isGenerating}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-xl hover:-translate-y-0.5"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            <span>Generate PDF</span>
          </button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 mt-8">
        
        {/* Left: Editor Column */}
        <div className="lg:col-span-7 space-y-8 no-print">
          
          {/* Section 1: Scope */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Briefcase className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Mission Parameters</h2>
            </div>
            <div className="space-y-6">
              <div className="group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block group-focus-within:text-emerald-600 transition-colors">Target Recipient / Client</label>
                <input 
                  type="text" 
                  name="attention" 
                  value={formData.attention} 
                  onChange={handleTopLevelChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white px-6 py-4 rounded-2xl outline-none transition-all font-semibold"
                  placeholder="e.g. Barrick Lumwana Mining PLC"
                />
              </div>
              <div className="group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block group-focus-within:text-emerald-600 transition-colors">Scope of Field Work</label>
                <textarea 
                  name="workDescription" 
                  value={formData.workDescription} 
                  onChange={handleTopLevelChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white px-6 py-4 rounded-2xl outline-none transition-all font-medium h-32"
                  placeholder="Provide details of the survey, inspection, or verification..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Personnel */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-50 rounded-2xl">
                  <Users className="text-orange-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-800">Deployment Team</h2>
              </div>
              <button 
                onClick={addPersonnel}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all border border-emerald-100"
              >
                <Plus size={16} /> Add Personnel
              </button>
            </div>
            <div className="space-y-4">
              {formData.personnel.map((p) => (
                <div key={p.id} className="relative group p-6 rounded-3xl bg-slate-50 border-2 border-transparent hover:border-emerald-100 hover:bg-white transition-all grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Role / Rank</label>
                    <select 
                      value={p.role} 
                      onChange={(e) => handlePersonnelChange(p.id, 'role', e.target.value)}
                      className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl outline-none focus:ring-2 ring-emerald-500 font-bold text-sm"
                    >
                      {ROLES.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Officers</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={p.numOfficers} 
                      onChange={(e) => handlePersonnelChange(p.id, 'numOfficers', parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl outline-none focus:ring-2 ring-emerald-500 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Days</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={p.numDays} 
                      onChange={(e) => handlePersonnelChange(p.id, 'numDays', parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl outline-none focus:ring-2 ring-emerald-500 font-mono font-bold"
                    />
                  </div>
                  <button 
                    onClick={() => removePersonnel(p.id)}
                    className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Mapping */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-50 rounded-2xl">
                <MapIcon className="text-blue-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Geospatial Logistics</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Base Station</label>
                    <select 
                      name="station" 
                      value={formData.station} 
                      onChange={handleTopLevelChange}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl font-bold"
                    >
                      {Object.keys(STATION_COORDS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Operational District</label>
                    <input 
                      list="district-list" 
                      name="manualDistrict" 
                      value={formData.manualDistrict} 
                      onChange={handleTopLevelChange}
                      placeholder="Search District..."
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl font-bold placeholder:font-normal"
                    />
                    <datalist id="district-list">
                      {DISTRICTS.map(d => <option key={d.name} value={d.name} />)}
                    </datalist>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                    <Truck size={80} />
                  </div>
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-widest">
                      <Zap size={14} /> Logistics Feed
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-slate-400 text-[10px] font-bold uppercase">Estimated Field Distance</p>
                        <p className="text-3xl font-black font-mono">{calcMetrics.totalDistance.toFixed(1)} <span className="text-sm font-bold opacity-50">km</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-[10px] font-bold uppercase">Focus Site</p>
                        <p className="font-bold text-orange-400 truncate max-w-[150px]">{calcMetrics.furthestSiteName || "N/A"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fuel Price (ZMW/L)</label>
                        <input 
                          type="number" 
                          name="fuelPrice" 
                          value={formData.fuelPrice} 
                          onChange={handleTopLevelChange}
                          className="bg-slate-800 w-full px-3 py-2 rounded-lg font-mono text-sm outline-none focus:ring-1 ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fleet Count</label>
                        <input 
                          type="number" 
                          name="numVehicles" 
                          min="1"
                          value={formData.numVehicles} 
                          onChange={handleTopLevelChange}
                          className="bg-slate-800 w-full px-3 py-2 rounded-lg font-mono text-sm outline-none focus:ring-1 ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center bg-slate-50/50 hover:bg-slate-50 hover:border-emerald-200 transition-all relative">
                  <input 
                    type="file" 
                    accept=".kml" 
                    multiple 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                      <Upload className="text-emerald-600" size={32} />
                    </div>
                    <p className="font-black text-slate-700">Drop KML Survey Files</p>
                    <p className="text-xs text-slate-400 font-bold mt-1">Boundaries will be parsed and projected on map</p>
                  </div>
                </div>

                {formData.kmlFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.kmlFiles.map(file => (
                      <div key={file.id} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-black shadow-sm group">
                        <span className="truncate max-w-[100px]">{file.name}</span>
                        <button onClick={() => removeKmlFile(file.id)} className="text-slate-400 hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-100 rounded-[2rem] overflow-hidden border-2 border-slate-50 relative min-h-[400px]">
                {!window.L && (
                   <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
                     <Loader2 className="animate-spin text-emerald-600" />
                   </div>
                )}
                <div ref={mapRef} className="w-full h-full z-10" />
              </div>
            </div>
          </div>

          {/* Section 4: Sign-off */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-indigo-50 rounded-2xl">
                <ShieldCheck className="text-indigo-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Verification & Sign-off</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Authorized Preparer</label>
                <input 
                  type="text" 
                  name="preparedBy" 
                  value={formData.preparedBy} 
                  onChange={handleTopLevelChange}
                  className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl outline-none font-bold text-sm border border-transparent focus:border-emerald-100 focus:bg-white"
                  placeholder="Officer Full Name"
                />
                <input 
                  type="text" 
                  name="preparedTitle" 
                  value={formData.preparedTitle} 
                  onChange={handleTopLevelChange}
                  className="w-full text-xs font-bold text-slate-400 outline-none bg-transparent px-2"
                  placeholder="Official Designation"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Reviewing Authority</label>
                <input 
                  type="text" 
                  name="managerSurvey" 
                  value={formData.managerSurvey} 
                  onChange={handleTopLevelChange}
                  className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl outline-none font-bold text-sm border border-transparent focus:border-indigo-100 focus:bg-white"
                  placeholder="Approver Full Name"
                />
                <input 
                  type="text" 
                  name="checkedTitle" 
                  value={formData.checkedTitle} 
                  onChange={handleTopLevelChange}
                  className="w-full text-xs font-bold text-slate-400 outline-none bg-transparent px-2"
                  placeholder="Title (e.g. Manager Survey)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Preview Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-[100px] max-h-[calc(100vh-140px)] overflow-y-auto pr-4 scroll-smooth">
            <div ref={invoiceRef} className="flex flex-col gap-8">
              
              {/* PAGE 1 PREVIEW */}
              <div className="bg-white aspect-[210/297] w-full p-12 shadow-2xl rounded-sm border relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-full h-2 bg-emerald-800" />
                
                <header className="flex justify-between items-start mb-8">
                  <div className="w-16 h-16 relative group cursor-pointer no-print">
                    <img src={formData.mrcLogo || DEFAULT_MRC_LOGO} className="w-full h-full object-contain" alt="MRC" />
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleLogoUpload(e, 'mrcLogo')} />
                  </div>
                  <div className="text-center flex-1 px-4">
                    <h2 className="text-[16px] font-black text-emerald-900 uppercase leading-tight">Minerals Regulation Commission</h2>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Mining Rights & Regulatory Department</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">- Survey Section -</p>
                  </div>
                  <div className="w-16 h-16 relative group cursor-pointer no-print">
                    <img src={formData.coaLogo || DEFAULT_COA_LOGO} className="w-full h-full object-contain" alt="CoA" />
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleLogoUpload(e, 'coaLogo')} />
                  </div>
                </header>

                <div className="border-y border-slate-100 py-6 mb-10 text-center relative">
                   <h1 className="text-3xl font-black text-emerald-900 tracking-[0.3em] uppercase opacity-90">Official Invoice</h1>
                   <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest">
                     Generated on {new Date().toLocaleDateString('en-GB')}
                   </p>
                </div>

                <div className="space-y-8 flex-grow">
                  <div className="grid grid-cols-2 gap-12">
                    <div>
                      <p className="text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Addressed To</p>
                      <p className="text-sm font-black text-slate-800 border-b border-slate-50 pb-1">{formData.attention || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Reference</p>
                      <p className="text-sm font-mono font-bold text-slate-800">MRC/INV/{new Date().getFullYear()}/{Math.floor(Math.random()*9000)+1000}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] font-black text-emerald-600 uppercase mb-2 tracking-widest">Assignment Parameters</p>
                    <p className="text-[11px] text-slate-700 bg-emerald-50/30 p-4 rounded-xl leading-relaxed italic border-l-4 border-emerald-500 shadow-sm">
                      {formData.workDescription || "Awaiting task description details..."}
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Geographic Site Projections</p>
                      {formData.manualDistrict && (
                        <p className="text-[8px] font-bold text-emerald-600 uppercase px-2 py-0.5 bg-emerald-50 rounded">Dist: {formData.manualDistrict}</p>
                      )}
                    </div>
                    <div className="h-64 rounded-2xl overflow-hidden border border-slate-100 relative grayscale-[0.3]">
                      <div ref={previewMapRef} className="w-full h-full pointer-events-none" />
                      <div className="absolute bottom-2 right-2 z-20 text-[6px] font-bold text-slate-300 pointer-events-none">MRC GEOSPATIAL MAP SERVICE</div>
                    </div>
                  </div>
                </div>

                <footer className="mt-12 text-[8px] font-bold text-slate-300 text-center uppercase tracking-widest">
                  Official Communication - Minerals Regulation Commission - Page 1
                </footer>
              </div>

              {/* PAGE 2 PREVIEW */}
              <div className="bg-white aspect-[210/297] w-full p-12 shadow-2xl rounded-sm border relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-full h-2 bg-emerald-800 opacity-20" />
                
                <div className="space-y-10 flex-grow pt-8">
                  <table className="w-full text-[11px]">
                    <thead className="border-b-2 border-emerald-50">
                      <tr>
                        <th className="text-left py-4 font-black text-emerald-700 uppercase tracking-widest">Description of Particulars</th>
                        <th className="text-right py-4 font-black text-emerald-700 uppercase tracking-widest">Total (ZMW)</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600 font-medium">
                      {formData.personnel.map(p => (
                        <tr key={p.id} className="border-b border-slate-50">
                          <td className="py-4">
                            <div className="font-black text-slate-800 uppercase">{p.role} Deployment</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase">
                              {p.numOfficers} Staff Member/s x {p.numDays} Operational Day/s @ K{p.dsaRate}
                            </div>
                          </td>
                          <td className="text-right font-mono font-black text-slate-800 text-[12px]">
                            {(p.numOfficers * p.numDays * p.dsaRate).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-4">
                          <div className="font-black text-slate-800 uppercase">Field Logistics & Fuel</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">
                            Distance: {calcMetrics.totalDistance.toFixed(1)} km | Base: {formData.station} | Units: {formData.numVehicles}
                          </div>
                        </td>
                        <td className="text-right font-mono font-black text-slate-800 text-[12px]">
                          {totals.fuelTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex flex-col items-end gap-3 mt-4">
                    <div className="w-full max-w-[280px] space-y-2">
                      <div className="flex justify-between items-center px-4 py-2 bg-slate-50 rounded-lg">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Mission Subtotal</span>
                        <span className="font-mono font-bold text-slate-800">{totals.cumulativeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2 text-orange-600">
                        <span className="text-[9px] font-black uppercase tracking-widest">Contingency (10%)</span>
                        <span className="font-mono font-bold">{totals.contingency.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center bg-emerald-900 p-6 rounded shadow-xl border-l-4 border-orange-500 mt-4">
                        <span className="text-[12px] font-black text-white uppercase tracking-widest">Total Payables</span>
                        <span className="text-2xl font-black text-white font-mono tracking-tighter">
                          K{totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 p-8 bg-slate-900 text-white rounded-3xl relative overflow-hidden group shadow-lg">
                    <Building className="absolute -bottom-4 -right-4 opacity-5 group-hover:rotate-12 transition-transform" size={140} />
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-3 border-b border-slate-800 pb-3">
                      <Building size={16} /> Settlement Repository
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                      <div className="space-y-1">
                        <p className="text-slate-500">Account Name</p>
                        <p className="text-slate-100">{BANK_DETAILS.accountName}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500">Bank / Branch</p>
                        <p className="text-slate-100">{BANK_DETAILS.bankName} - {BANK_DETAILS.branch}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500">Account Number</p>
                        <p className="text-orange-400 font-mono text-lg tracking-widest">{BANK_DETAILS.accountNumber}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500">Swift Code</p>
                        <p className="text-slate-100 font-mono">{BANK_DETAILS.swiftCode}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-10 grid grid-cols-2 gap-20">
                  <div className="text-center">
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">{formData.preparedBy || "Survey Officer"}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{formData.preparedTitle || "Commission Surveyor"}</p>
                      <p className="text-[7px] text-slate-300 mt-2 font-black italic">Electronically Verifiable</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">{formData.managerSurvey || "Authorizing Agent"}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{formData.checkedTitle || "Head of Section"}</p>
                      <div className="mt-2 flex justify-center gap-2 opacity-10">
                         <div className="w-10 h-1 rounded-full bg-slate-900" />
                         <div className="w-4 h-1 rounded-full bg-slate-900" />
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="mt-8 text-[8px] font-bold text-slate-300 text-center uppercase tracking-widest">
                  Official Communication - Minerals Regulation Commission - Page 2
                </footer>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Notification */}
      {isGenerating && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] border-2 border-emerald-500 animate-bounce">
          <Loader2 className="animate-spin text-emerald-500" />
          <span className="font-black uppercase text-xs tracking-widest">Processing High-Resolution Document...</span>
        </div>
      )}
    </div>
  );
};

export default App;
