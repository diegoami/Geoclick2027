// Apply current legal province groupings to openly licensed input polygons.
import { execFileSync } from 'node:child_process';
export function deriveAngolaProvinces(
	admin1File: string,
	municipalitiesFile: string,
	outFile: string
): void {
	execFileSync(
		'python3',
		[
			'-c',
			`
import sys,json,math,collections
from osgeo import ogr
ogr.UseExceptions()
def union(parts):
 result=None
 for g in parts:result=g.Clone() if result is None else result.Union(g)
 return result.MakeValid()
def partition(original,east,west):
 line=east.Boundary().Intersection(west.Boundary())
 pieces=[line] if line.GetGeometryType()==ogr.wkbLineString else [line.GetGeometryRef(i).Clone() for i in range(line.GetGeometryCount())]
 ends=collections.defaultdict(list)
 for g in pieces:
  if g.GetPointCount()<2:continue
  pts=g.GetPoints()
  ends[tuple(round(v,10) for v in pts[0][:2])].append((pts[0],pts[1]))
  ends[tuple(round(v,10) for v in pts[-1][:2])].append((pts[-1],pts[-2]))
 endpoints=[v[0] for v in ends.values() if len(v)==1]
 assert len(endpoints)==2,len(endpoints)
 for p,q in endpoints:
  dx=p[0]-q[0];dy=p[1]-q[1];length=math.hypot(dx,dy)
  extension=ogr.Geometry(ogr.wkbLineString);extension.AddPoint_2D(p[0],p[1]);extension.AddPoint_2D(p[0]+dx/length,p[1]+dy/length)
  line=line.Union(extension)
 faces=original.Boundary().Union(line).Polygonize();sides=[[],[]]
 for i in range(faces.GetGeometryCount()):
  part=faces.GetGeometryRef(i)
  if not original.Contains(part.PointOnSurface()):continue
  a=part.Intersection(east).GetArea();b=part.Intersection(west).GetArea()
  assert max(a,b)>0
  sides[0 if a>b else 1].append(part.Clone())
 east,west=[union(x) for x in sides]
 assert abs(original.GetArea()-east.GetArea()-west.GetArea())<1e-7
 assert east.Intersection(west).GetArea()<1e-8
 return east,west
base=json.load(open(sys.argv[1]));municipal=json.load(open(sys.argv[2]))
polys={f['properties']['name']:ogr.CreateGeometryFromJson(json.dumps(f['geometry'])).MakeValid() for f in base['features']}
assert len(polys)==19
cuts=[('Moxico','Moxico Leste',['Alto Zambeze','Cameia (Lumeje)','Luacano','Luau'],'Moxico'),('Cuando Cubango','Cuando',['Cuito Cuanavale','Dirico','Mavinga','Rivungo'],'Cubango')]
for old,new,names,remainder in cuts:
 own=[f for f in municipal['features'] if f['properties']['adm1_name']==old]
 selected=[f for f in own if f['properties']['adm2_name'] in names]
 assert len(selected)==4 and len(own)==9,(old,len(selected),len(own))
 east=union([ogr.CreateGeometryFromJson(json.dumps(f['geometry'])) for f in selected])
 west=union([ogr.CreateGeometryFromJson(json.dumps(f['geometry'])) for f in own if f['properties']['adm2_name'] not in names])
 east,west=partition(polys.pop(old),east,west)
 polys[new]=east;polys[remainder]=west
polys['Icolo e Bengo']=polys.pop('Província de Ícolo e Bengo')
expected={'Bengo','Benguela','Bié','Cabinda','Cuando','Cubango','Cuanza Norte','Cuanza Sul','Cunene','Huambo','Huíla','Icolo e Bengo','Luanda','Lunda Norte','Lunda Sul','Malanje','Moxico','Moxico Leste','Namibe','Uíge','Zaire'}
assert set(polys)==expected
anchors={'Luena':('Moxico',19.907,-11.783),'Cazombo':('Moxico Leste',22.944,-11.892),'Menongue':('Cubango',17.691,-14.658),'Mavinga':('Cuando',20.354,-15.789),'Catete':('Icolo e Bengo',13.69,-9.11)}
for town,(region,lon,lat) in anchors.items():
 point=ogr.CreateGeometryFromWkt('POINT ('+str(lon)+' '+str(lat)+')')
 assert [name for name,g in polys.items() if g.Contains(point)]==[region],town
features=[{'type':'Feature','properties':{'name':name},'geometry':json.loads(g.ExportToJson())} for name,g in sorted(polys.items())]
with open(sys.argv[3],'w') as f:json.dump({'type':'FeatureCollection','features':features},f,ensure_ascii=False)
`,
			admin1File,
			municipalitiesFile,
			outFile
		],
		{ stdio: 'inherit' }
	);
}
