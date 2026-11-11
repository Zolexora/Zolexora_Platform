import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Plus, Video, Trash2, Eye } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { reelsApi, productsApi } from "../../src/lib/api";
import Toast from "react-native-toast-message";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function SellerReelsScreen() {
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string|null>(null);

  useEffect(() => { reelsApi.my().then(setReels).finally(() => setLoading(false)); }, []);

  const handleCreate = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes:ImagePicker.MediaTypeOptions.All, quality:0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    setCreating(true);
    try {
      const asset = res.assets[0];
      const reel = await reelsApi.create({ title:"New Reel", description:"", content_type:"organic" });
      const isVideo = asset.type === "video";
      await reelsApi.uploadMedia(reel.id, asset.uri, isVideo ? "video/mp4" : "image/jpeg");
      const updated = { ...reel, video_url: asset.uri };
      setReels(rs => [updated, ...rs]);
      Toast.show({ type:"success", text1:"Reel published!" });
    } catch { Toast.show({ type:"error", text1:"Failed to create reel" }); }
    finally { setCreating(false); }
  };

  const handleDelete = (r: any) => {
    Alert.alert("Delete Reel", "Delete this reel?", [
      { text:"Cancel", style:"cancel" },
      { text:"Delete", style:"destructive", onPress: async () => {
        await reelsApi.delete(r.id);
        setReels(rs => rs.filter(x => x.id!==r.id));
        Toast.show({ type:"success", text1:"Reel deleted" });
      }},
    ]);
  };

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large" /></View>;

  return (
    <View style={ss.container}>
      <View style={ss.header}>
        <View><Text style={ss.title}>Reels</Text><Text style={ss.sub}>{reels.length} reels · earn coins on views</Text></View>
        <TouchableOpacity style={ss.addBtn} onPress={handleCreate} disabled={creating}>
          <Plus size={18} color="#111" />
          <Text style={ss.addBtnText}>{creating?"Uploading...":"Upload"}</Text>
        </TouchableOpacity>
      </View>

      {reels.length === 0 ? (
        <View style={ss.empty}>
          <Video size={40} color="rgba(255,255,255,0.1)" />
          <Text style={ss.emptyTitle}>No reels yet</Text>
          <Text style={ss.emptySub}>Upload reels to earn coins</Text>
          <TouchableOpacity style={ss.createBtn} onPress={handleCreate}><Text style={ss.createBtnText}>Upload First Reel</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList data={reels} keyExtractor={r=>r.id} numColumns={2} columnWrapperStyle={ss.row}
          contentContainerStyle={ss.list} showsVerticalScrollIndicator={false}
          renderItem={({ item:r, index }) => (
            <Animated.View entering={FadeInDown.delay(index*50)} style={ss.reelCard}>
              <View style={ss.reelMedia}>
                {r.video_url
                  ? <Image source={{ uri:r.video_url }} style={ss.reelImg} />
                  : <View style={[ss.reelImg, ss.reelPlaceholder]}><Video size={28} color="rgba(255,255,255,0.2)" /></View>}
                <View style={ss.reelBadge}>
                  <Text style={[ss.reelBadgeText, r.content_type==="sponsored" && { color:"#FFB800" }]}>
                    {r.content_type==="sponsored"?"Sponsored":"Organic"}
                  </Text>
                </View>
                <TouchableOpacity style={ss.deleteBtn} onPress={() => handleDelete(r)}>
                  <Trash2 size={13} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View style={ss.reelInfo}>
                <Text style={ss.reelTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={ss.reelViews}><Eye size={10} color="rgba(255,255,255,0.3)" /> {r.views_count} views</Text>
              </View>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#111" },
  centered: { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#111" },
  header: { flexDirection:"row", alignItems:"flex-start", justifyContent:"space-between", paddingHorizontal:20, paddingTop:56, paddingBottom:16 },
  title: { fontSize:22, fontWeight:"900", color:"#fff" },
  sub: { fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 },
  addBtn: { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#FFB800", borderRadius:14, paddingHorizontal:14, paddingVertical:8 },
  addBtnText: { fontSize:13, fontWeight:"900", color:"#111" },
  list: { padding:12, paddingBottom:100 },
  row: { gap:12, marginBottom:12 },
  reelCard: { flex:1, backgroundColor:"rgba(255,255,255,0.05)", borderRadius:18, overflow:"hidden" },
  reelMedia: { position:"relative", aspectRatio:9/16 },
  reelImg: { width:"100%", height:"100%", resizeMode:"cover" },
  reelPlaceholder: { backgroundColor:"rgba(255,255,255,0.06)", alignItems:"center", justifyContent:"center" },
  reelBadge: { position:"absolute", top:8, left:8, backgroundColor:"rgba(0,0,0,0.6)", borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  reelBadgeText: { fontSize:9, fontWeight:"800", color:"rgba(255,255,255,0.7)" },
  deleteBtn: { position:"absolute", bottom:8, right:8, width:28, height:28, backgroundColor:"rgba(0,0,0,0.7)", borderRadius:8, alignItems:"center", justifyContent:"center" },
  reelInfo: { padding:10 },
  reelTitle: { fontSize:12, fontWeight:"700", color:"#fff" },
  reelViews: { fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 },
  empty: { flex:1, alignItems:"center", justifyContent:"center", gap:10 },
  emptyTitle: { fontSize:16, fontWeight:"800", color:"rgba(255,255,255,0.3)" },
  emptySub: { fontSize:12, color:"rgba(255,255,255,0.2)" },
  createBtn: { backgroundColor:"#FFB800", borderRadius:16, paddingHorizontal:20, paddingVertical:10, marginTop:4 },
  createBtnText: { fontSize:13, fontWeight:"800", color:"#111" },
});
