include("script/campaign/libcampaign.js");
include("script/campaign/templates.js");

const Y_SCROLL_LIMIT = 137;
const LASSAT_FIRING = "pcv650.ogg"; // LASER SATELLITE FIRING!!!
const NEXUS_RES = [
	"R-Defense-WallUpgrade09", "R-Struc-Materials09", "R-Struc-Factory-Upgrade06",
	"R-Struc-Factory-Cyborg-Upgrade06", "R-Struc-VTOLFactory-Upgrade06",
	"R-Struc-VTOLPad-Upgrade06", "R-Vehicle-Engine09", "R-Vehicle-Metals09",
	"R-Cyborg-Metals09", "R-Vehicle-Armor-Heat06", "R-Cyborg-Armor-Heat06",
	"R-Sys-Engineering03", "R-Vehicle-Prop-Hover02", "R-Vehicle-Prop-VTOL02",
	"R-Wpn-Bomb-Accuracy03", "R-Wpn-Energy-Accuracy01", "R-Wpn-Energy-Damage03",
	"R-Wpn-Energy-ROF03", "R-Wpn-Missile-Accuracy01", "R-Wpn-Missile-Damage02",
	"R-Wpn-Rail-Accuracy01", "R-Wpn-Rail-Damage03", "R-Wpn-Rail-ROF03",
	"R-Sys-Sensor-Upgrade01", "R-Sys-NEXUSrepair", "R-Wpn-Flamer-Damage06",
];
const VTOL_POSITIONS = [
	"vtolAppearPosW", "vtolAppearPosE",
];
var winFlag;
var mapLimit;
var videoInfo; //holds some info about when to play a video.

//Remove Nexus VTOL droids.
camAreaEvent("vtolRemoveZone", function(droid)
{
	if (droid.player !== CAM_HUMAN_PLAYER)
	{
		if (isVTOL(droid))
		{
			camSafeRemoveObject(droid, false);
		}
	}

	resetLabel("vtolRemoveZone", NEXUS);
});

//Return a random assortment of droids with the given templates.
function randomTemplates(list)
{
	var extras; with (camTemplates) extras = [nxmstrike, nxmsamh];
	var droids = [];
	var size = 12 + camRand(4); //Max of 15.

	for (var i = 0; i < size; ++i)
	{
		droids.push(list[camRand(list.length)]);
	}

	//Vtol strike sensor and vindicator hovers.
	for (var i = 0; i < 4; ++i)
	{
		droids.push(extras[camRand(extras.length)]);
	}

	return droids;
}

//Chose a random spawn point for the VTOLs.
function vtolAttack()
{
	var list; with (camTemplates) list = [nxmheapv, nxlpulsev];
	camSetVtolData(NEXUS, VTOL_POSITIONS, "vtolRemovePos", list, camChangeOnDiff(180000)); // 3 min
}

//Chose a random spawn point to send ground reinforcements.
function phantomFactorySpawn()
{
	var list;
	var chosenFactory;

	switch (camRand(3))
	{
		case 0:
			with (camTemplates) list = [nxhgauss, nxmpulseh, nxmlinkh];
			chosenFactory = "phantomFacWest";
			break;
		case 1:
			with (camTemplates) list = [nxhgauss, nxmpulseh, nxmlinkh];
			chosenFactory = "phantomFacEast";
			break;
		case 2:
			with (camTemplates) list = [nxcylas, nxcyrail, nxcyscou, nxhgauss, nxmpulseh, nxmlinkh];
			chosenFactory = "phantomFacMiddle";
			break;
		default:
			with (camTemplates) list = [nxhgauss, nxmpulseh, nxmlinkh];
			chosenFactory = "phantomFacWest";
	}

	if (countDroid(DROID_ANY, NEXUS) < 80)
	{
		camSendReinforcement(NEXUS, camMakePos(chosenFactory), randomTemplates(list), CAM_REINFORCE_GROUND, {
			data: { regroup: false, count: -1, },
		});
	}

	queue("phantomFactorySpawn", camChangeOnDiff(300000)); // 5 min
}

//Choose a target to fire the LasSat at. Automatically increases the limits
//when no target is found in the area.
function vaporizeTarget()
{
	var target;
	var targets = enumArea(0, Y_SCROLL_LIMIT, mapWidth, Math.floor(mapLimit), CAM_HUMAN_PLAYER, false).filter(function(obj) {
		return obj.type === DROID || (obj.type === STRUCTURE && obj.status === BUILT);
	});

	if (!targets.length)
	{
		//Choose random coordinate within the limits.
		target = {
			"x": camRand(mapWidth),
			"y": Y_SCROLL_LIMIT + camRand(mapHeight - Math.floor(mapLimit)),
		};

		if (target.y > Math.floor(mapLimit))
		{
			target.y = Math.floor(mapLimit);
		}
	}
	else
	{
		var dr = targets.filter(function(obj) { return obj.type === DROID; });
		var st = targets.filter(function(obj) { return obj.type === STRUCTURE; });

		if (dr.length)
		{
			target = camMakePos(dr[0]);
		}
		if (st.length && !camRand(2)) //chance to focus on a structure
		{
			target = camMakePos(st[0]);
		}
	}


	//Stop firing LasSat if the third missile unlock code was researched.
	if (winFlag === false)
	{
		//Droid or structure was destroyed before firing so pick a new one.
		if (!camDef(target))
		{
			queue("vaporizeTarget", 100);
			return;
		}
		if (Math.floor(mapLimit) < mapHeight)
		{
			//Need to travel about 119 tiles in ~1 hour so:
			//119 tiles / 60 minutes = 1.983 tiles per minute
			//1.983 tile per minute / 60 seconds = 0.03305 tiles per second
			//0.03305 * 10 sec = ~0.33 tiles per blast at 10 second intervals.
			mapLimit = mapLimit + 0.33; //sector clear; move closer
		}
		laserSatFuzzyStrike(target);
		queue("vaporizeTarget", 10000);
	}
}

//A simple way to fire the LasSat with a chance of missing.
function laserSatFuzzyStrike(obj)
{
	const LOC = camMakePos(obj);
	//Initially lock onto target
	var xCoord = LOC.x;
	var yCoord = LOC.y;

	//Introduce some randomness
	if (camRand(101) < 67)
	{
		var xRand = camRand(2);
		var yRand = camRand(2);
		xCoord = camRand(2) ? LOC.x - xRand : LOC.x + xRand;
		yCoord = camRand(2) ? LOC.y - yRand : LOC.y + yRand;
	}

	if (xCoord < 0)
	{
		xCoord = 0;
	}
	else if (xCoord > mapWidth)
	{
		xCoord = mapWidth;
	}

	if (yCoord < 0)
	{
		yCoord = 0;
	}
	else if (yCoord > Math.floor(mapLimit))
	{
		yCoord = Math.floor(mapLimit);
	}

	if (winFlag === false)
	{
		if (camRand(101) < 40)
		{
			playSound(LASSAT_FIRING, xCoord, yCoord);
		}
		fireWeaponAtLoc(xCoord, yCoord, "LasSat");
	}
}

//Play videos and allow winning once the final one is researched.
function eventResearched(research, structure, player)
{
	for (var i = 0, l = videoInfo.length; i < l; ++i)
	{
		if (research.name === videoInfo[i].res && !videoInfo[i].played)
		{
			videoInfo[i].played = true;
			camPlayVideos(videoInfo[i].video);
			if (videoInfo[i].res === "R-Sys-Resistance")
			{
				enableResearch("R-Comp-MissileCodes01", CAM_HUMAN_PLAYER);
			}
			else if (videoInfo[i].res === "R-Comp-MissileCodes03")
			{
				winFlag = true;
			}
		}
	}
}

//For checking when the five minute delay is over.
function checkTime()
{
	if (getMissionTime() <= 2)
	{
		camPlayVideos("MB3_AD2_MSG2");
		setMissionTime(3600); //1 hr
		phantomFactorySpawn();
		queue("vaporizeTarget", 2000);
	}
	else
	{
		queue("checkTime", 150);
	}
}

//Check if the silos still exist and only allow winning if the player captured them.
//NOTE: Being in cheat mode disables the extra failure condition.
function checkMissileSilos()
{
	if (winFlag)
	{
		return true;
	}

	if (!isCheating() && !countStruct("NX-ANTI-SATSite", CAM_HUMAN_PLAYER))
	{
		return false;
	}
}

function eventStartLevel()
{
	var startpos = getObject("startPosition");
	var lz = getObject("landingZone");
	mapLimit = 137.0;
	winFlag = false;
	videoInfo = [
		{played: false, video: "MB3_AD2_MSG3", res: "R-Sys-Resistance"},
		{played: false, video: "MB3_AD2_MSG4", res: "R-Comp-MissileCodes01"},
		{played: false, video: "MB3_AD2_MSG5", res: "R-Comp-MissileCodes02"},
		{played: false, video: "MB3_AD2_MSG6", res: "R-Comp-MissileCodes03"},
	];

	camSetStandardWinLossConditions(CAM_VICTORY_STANDARD, "CAM_3_4S", {
		callback: "checkMissileSilos"
	});

	setScrollLimits(0, Y_SCROLL_LIMIT, 64, 256);

	//Destroy everything above limits
	var destroyZone = enumArea(0, 0, 64, Y_SCROLL_LIMIT, CAM_HUMAN_PLAYER, false);
	for (var i = 0, l = destroyZone.length; i < l; ++i)
	{
		camSafeRemoveObject(destroyZone[i], false);
	}

	centreView(startpos.x, startpos.y);
	setNoGoArea(lz.x, lz.y, lz.x2, lz.y2, CAM_HUMAN_PLAYER);
	setMissionTime(300); //5 min
	enableResearch("R-Sys-Resistance", CAM_HUMAN_PLAYER);

	setPower(AI_POWER, NEXUS);
	camCompleteRequiredResearch(NEXUS_RES, NEXUS);
	camPlayVideos("MB3_AD2_MSG");

	queue("checkTime", 200);
	queue("vtolAttack", camChangeOnDiff(180000)); // 3 min
}
